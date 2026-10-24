from django.db.models import Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.login.auditoria import registrar
from apps.login.models import Paciente
from apps.login.permissions import IsMedico, IsPaciente

from .models import ResultadoClinico
from .serializers import ResultadoSerializer
from .services import guardar_resultado


def pacientes_visibles(tutor):
    return Paciente.objects.filter(Q(pk=tutor.pk) | Q(tutor=tutor))


class ResultadosView(APIView):
    """
    Búsqueda de resultados del paciente autenticado y de sus menores.

    Filtros: nombre (título o paciente), fecha y doctor. Un paciente no puede
    consultar resultados de otra familia aunque conozca el identificador.
    """

    permission_classes = [IsPaciente]

    def get(self, request):
        tutor = request.user.perfil_paciente
        resultados = ResultadoClinico.objects.filter(
            paciente__in=pacientes_visibles(tutor),
        ).select_related('paciente', 'medico__usuario')

        nombre = (request.query_params.get('nombre') or '').strip()
        doctor = (request.query_params.get('doctor') or '').strip()
        fecha = parse_date(request.query_params.get('fecha') or '')
        if request.query_params.get('fecha') and fecha is None:
            raise ValidationError({'detail': 'La fecha debe tener el formato AAAA-MM-DD.'})

        if nombre:
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


class DescargarResultadoView(APIView):
    permission_classes = [IsPaciente]

    def get(self, request, resultado_id):
        tutor = request.user.perfil_paciente
        try:
            resultado = ResultadoClinico.objects.select_related('paciente').get(
                pk=resultado_id,
                paciente__in=pacientes_visibles(tutor),
            )
        except ResultadoClinico.DoesNotExist:
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
