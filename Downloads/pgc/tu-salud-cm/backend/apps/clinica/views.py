from datetime import timedelta

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.login.auditoria import registrar
from apps.agenda.models import Cita
from apps.login.models import Paciente
from apps.login.permissions import IsMedico, IsMedicoOAdmin, IsPaciente

from .models import ResultadoClinico
from .serializers import ResultadoSerializer
from .services import guardar_resultado


def pacientes_visibles(tutor):
    return Paciente.objects.filter(Q(pk=tutor.pk) | Q(tutor=tutor))


class ResultadosView(APIView):
    """
    Búsqueda de resultados del paciente autenticado y de sus menores.

    Filtros: paciente (id visible), fecha y doctor. Un paciente no puede
    consultar resultados de otra familia aunque conozca el identificador.
    """

    permission_classes = [IsPaciente]

    def get(self, request):
        tutor = request.user.perfil_paciente
        visibles = pacientes_visibles(tutor)
        resultados = ResultadoClinico.objects.filter(
            paciente__in=visibles,
        ).select_related('paciente', 'medico__usuario')

        paciente_id = (request.query_params.get('paciente') or '').strip()
        nombre = (request.query_params.get('nombre') or '').strip()
        doctor = (request.query_params.get('doctor') or '').strip()
        fecha = parse_date(request.query_params.get('fecha') or '')
        if request.query_params.get('fecha') and fecha is None:
            raise ValidationError({'detail': 'La fecha debe tener el formato AAAA-MM-DD.'})

        if paciente_id:
            try:
                elegido = visibles.get(pk=int(paciente_id))
            except (ValueError, Paciente.DoesNotExist) as exc:
                raise ValidationError({'detail': 'Ese paciente no está a su cargo.'}) from exc
            resultados = resultados.filter(paciente=elegido)
        elif nombre:
            resultados = resultados.filter(
                Q(titulo__icontains=nombre)
                | Q(paciente__nombres__icontains=nombre)
                | Q(paciente__apellidos__icontains=nombre)
            )
        if doctor:
            resultados = resultados.filter(
                Q(medico__usuario__first_name__icontains=doctor)
                | Q(medico__usuario__last_name__icontains=doctor)
                | Q(medico__registro_medico__icontains=doctor)
            )
        if fecha:
            resultados = resultados.filter(fecha_resultado=fecha)

        return Response(ResultadoSerializer(resultados, many=True).data)


class SubirResultadoView(APIView):
    permission_classes = [IsMedico]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        medico = request.user.perfil_medico
        titulo = (request.data.get('titulo') or '').strip()
        tipo = request.data.get('tipo') or ResultadoClinico.Tipo.REPORTE
        fecha = parse_date(request.data.get('fecha_resultado') or '')
        archivo = request.FILES.get('archivo')
        paciente_id = request.data.get('paciente_id')
        cita_id = request.data.get('cita_id') or None

        if not titulo or fecha is None or archivo is None or not paciente_id:
            raise ValidationError({
                'detail': 'Indique título, fecha, paciente y el archivo PDF.',
            })
        if tipo not in ResultadoClinico.Tipo.values:
            raise ValidationError({'detail': 'El tipo de resultado no es válido.'})

        try:
            paciente = Paciente.objects.get(pk=paciente_id)
        except Paciente.DoesNotExist:
            raise ValidationError({'detail': 'El paciente no existe.'})

        cita = None
        if cita_id:
            cita = medico.citas.filter(pk=cita_id, paciente=paciente).first()
            if cita is None:
                raise ValidationError({'detail': 'La cita no corresponde a este profesional y paciente.'})
            ahora = timezone.now()
            if ahora < cita.inicio or ahora > cita.fin + timedelta(minutes=30):
                raise ValidationError({
                    'detail': 'La cita ya venció. Solo puede consultar la información cargada.',
                })
            if cita.estado != 'atendido':
                raise ValidationError({
                    'detail': 'Marque que el paciente asistió antes de cargar documentos.',
                })
        elif not medico.citas.filter(paciente=paciente).exists():
            raise ValidationError({
                'detail': 'Solo puede cargar resultados de pacientes que tengan una cita con usted.',
            })

        resultado = guardar_resultado(
            paciente=paciente,
            medico=medico,
            titulo=titulo,
            tipo=tipo,
            fecha_resultado=fecha,
            archivo=archivo,
            cita=cita,
        )
        registrar(
            request,
            'resultado_cargado',
            usuario=request.user,
            recurso=str(resultado.pk),
        )
        return Response(ResultadoSerializer(resultado).data, status=201)


class ResultadosCitaMedicoView(APIView):
    """Documentos ya cargados en una cita, como soporte de lo enviado."""

    permission_classes = [IsMedicoOAdmin]

    def get(self, request, cita_id):
        if request.user.is_admin:
            if not Cita.objects.filter(pk=cita_id).exists():
                raise NotFound('No se encontró la cita.')
            resultados = ResultadoClinico.objects.filter(cita_id=cita_id)
        else:
            medico = request.user.perfil_medico
            if not medico.citas.filter(pk=cita_id).exists():
                raise NotFound('No se encontró la cita.')
            resultados = ResultadoClinico.objects.filter(cita_id=cita_id, medico=medico)
        resultados = resultados.select_related('paciente', 'medico__usuario')
        return Response(ResultadoSerializer(resultados, many=True).data)


class DescargarResultadoView(APIView):
    def get(self, request, resultado_id):
        usuario = request.user
        resultado = None
        if getattr(usuario, 'is_patient', False):
            tutor = usuario.perfil_paciente
            resultado = ResultadoClinico.objects.select_related('paciente').filter(
                pk=resultado_id,
                paciente__in=pacientes_visibles(tutor),
            ).first()
        elif getattr(usuario, 'is_doctor', False):
            resultado = ResultadoClinico.objects.select_related('paciente').filter(
                pk=resultado_id,
                medico=usuario.perfil_medico,
            ).first()
        elif getattr(usuario, 'is_admin', False):
            resultado = ResultadoClinico.objects.select_related('paciente').filter(
                pk=resultado_id,
            ).first()
        if resultado is None:
            raise NotFound('No se encontró el resultado.')

        if not resultado.archivo:
            raise NotFound('El archivo no está disponible.')

        try:
            contenido = resultado.archivo.open('rb').read()
        except FileNotFoundError:
            raise NotFound('El archivo no está disponible.')
        finally:
            if resultado.archivo:
                resultado.archivo.close()

        registrar(
            request,
            'resultado_descargado',
            usuario=request.user,
            recurso=str(resultado.pk),
        )
        respuesta = HttpResponse(contenido, content_type='application/pdf')
        respuesta['Content-Disposition'] = f'attachment; filename="resultado-{resultado.pk}.pdf"'
        # El PDF sigue cifrado. El lector pide el documento del paciente.
        respuesta['X-PDF-Cifrado'] = 'cedula'
        return respuesta


class PacientesDelMedicoView(APIView):
    """Pacientes con al menos una cita confirmada con el médico, para el formulario de carga."""

    permission_classes = [IsMedico]

    def get(self, request):
        medico = request.user.perfil_medico
        pacientes = (
            Paciente.objects.filter(citas__medico=medico)
            .distinct()
            .order_by('apellidos', 'nombres')
        )
        return Response([
            {
                'id': paciente.id,
                'nombre': paciente.nombre_completo,
                'numero_documento': paciente.numero_documento,
            }
            for paciente in pacientes
        ])
