from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.login.models import Medico
from apps.login.permissions import IsAdmin, IsMedico, IsPaciente
from apps.login.serializers import MedicoSerializer

from .models import Cita, Horario
from .serializers import (
    CitaSerializer,
    CupoBloqueadoSerializer,
    GenerarCuposSerializer,
    HorarioSerializer,
)
from .services import (
    bloquear_cupo,
    cancelar_cita,
    confirmar_cupo,
    detalle_cupos_horario,
    generar_cupos,
    liberar_cupo,
    fechas_con_cupos,
    listar_cupos,
    paciente_del_usuario,
    registrar_asistencia,
)


class MedicosDisponiblesView(APIView):
    permission_classes = [IsPaciente]

    def get(self, request):
        medicos = Medico.objects.filter(activo=True).select_related('usuario')
        return Response(MedicoSerializer(medicos, many=True).data)


class FechasDisponiblesView(APIView):
    permission_classes = [IsPaciente]

    def get(self, request):
        try:
            medico_id = int(request.query_params.get('medico'))
        except (TypeError, ValueError):
            raise ValidationError({'detail': 'Indique el médico.'})
        if not Medico.objects.filter(pk=medico_id, activo=True).exists():
            raise ValidationError({'detail': 'El médico no está disponible en el canal web.'})
        return Response({'medico': medico_id, 'fechas': fechas_con_cupos(medico_id, request.user)})


class DisponibilidadView(APIView):
    permission_classes = [IsPaciente]

    def get(self, request):
        fecha = parse_date(request.query_params.get('fecha') or '')
        try:
            medico_id = int(request.query_params.get('medico'))
        except (TypeError, ValueError):
            medico_id = None
        if not medico_id or fecha is None:
            raise ValidationError({'detail': 'Indique el médico y la fecha (AAAA-MM-DD).'})
        if not Medico.objects.filter(pk=medico_id, activo=True).exists():
            raise ValidationError({'detail': 'El médico no está disponible en el canal web.'})
        cupos = listar_cupos(medico_id, fecha, request.user)
        return Response({'medico': medico_id, 'fecha': fecha.isoformat(), 'cupos': cupos})


class BloquearCupoView(APIView):
    permission_classes = [IsPaciente]

    def post(self, request):
        cita_id = request.data.get('cita_id')
        if not cita_id:
            raise ValidationError({'detail': 'Indique el cupo que desea reservar.'})
        cita = bloquear_cupo(cita_id, request.user)
        return Response(CupoBloqueadoSerializer(cita).data)


class LiberarCupoView(APIView):
    permission_classes = [IsPaciente]

    def post(self, request, cita_id):
        cita = liberar_cupo(cita_id, request.user)
        return Response(CupoBloqueadoSerializer(cita).data)


class ConfirmarCupoView(APIView):
    permission_classes = [IsPaciente]

    def post(self, request, cita_id):
        cita = confirmar_cupo(
            cita_id,
            request.user,
            request.data.get('paciente_id'),
            request.data.get('motivo', ''),
        )
        return Response(CitaSerializer(cita).data)


class MisCitasView(APIView):
    permission_classes = [IsPaciente]

    def get(self, request):
        solicitante = paciente_del_usuario(request.user)
        citas = (
            Cita.objects.filter(Q(solicitante=solicitante) | Q(paciente=solicitante))
            .exclude(estado__in=[Cita.Estado.DISPONIBLE, Cita.Estado.BLOQUEADO])
            .select_related('medico__usuario', 'paciente', 'solicitante')
            .order_by('-inicio')
        )
        return Response(CitaSerializer(citas, many=True).data)


class CancelarCitaView(APIView):
    permission_classes = [IsPaciente]

    def post(self, request, cita_id):
        cancelar_cita(cita_id, request.user)
        return Response({'detail': 'La cita fue cancelada y el cupo volvió a la oferta web.'})


def _evento_calendario(cita):
    paciente = cita.paciente
    usuario = paciente.usuario if paciente and paciente.usuario_id else None
    tutor = paciente.tutor if paciente and paciente.tutor_id else None
    return {
        'id': cita.id,
        'title': paciente.nombre_completo if paciente else 'Cupo bloqueado',
        'start': timezone.localtime(cita.inicio).isoformat(),
        'end': timezone.localtime(cita.fin).isoformat(),
        'estado': cita.estado,
        'motivo': cita.motivo,
        'paciente_id': paciente.id if paciente else None,
        'nombres': paciente.nombres if paciente else '',
        'apellidos': paciente.apellidos if paciente else '',
        'tipo_documento': paciente.tipo_documento if paciente else '',
        'numero_documento': paciente.numero_documento if paciente else '',
        'fecha_nacimiento': paciente.fecha_nacimiento.isoformat() if paciente else '',
        'telefono': usuario.telefono if usuario else '',
        'email': usuario.email if usuario else '',
        'tutor_nombre': tutor.nombre_completo if tutor else '',
    }


class CalendarioMedicoView(APIView):
    permission_classes = [IsMedico]

    def get(self, request):
        medico = request.user.perfil_medico
        desde = parse_date(request.query_params.get('desde') or '')
        hasta = parse_date(request.query_params.get('hasta') or '')
        citas = Cita.objects.filter(medico=medico).exclude(estado=Cita.Estado.DISPONIBLE)
        if desde:
            citas = citas.filter(inicio__date__gte=desde)
        if hasta:
            citas = citas.filter(inicio__date__lte=hasta)
        citas = citas.select_related(
            'paciente__usuario',
            'paciente__tutor',
            'medico__usuario',
        ).order_by('inicio')
        eventos = [
            _evento_calendario(cita)
            for cita in citas
            if cita.estado != Cita.Estado.BLOQUEADO or (
                cita.lease_expires_at and cita.lease_expires_at >= timezone.now()
            )
        ]
        return Response(eventos)


class AsistenciaView(APIView):
    permission_classes = [IsMedico]

    def post(self, request, cita_id):
        cita = registrar_asistencia(
            cita_id,
            request.user.perfil_medico,
            request.data.get('estado'),
        )
        return Response(CitaSerializer(cita).data)


class HorariosView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        horarios = Horario.objects.select_related('medico__usuario').all()
        medico = request.query_params.get('medico')
        if medico:
            horarios = horarios.filter(medico_id=medico)
        return Response(HorarioSerializer(horarios, many=True).data)

    def post(self, request):
        serializador = HorarioSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        horario = serializador.save()
        return Response(HorarioSerializer(horario).data, status=status.HTTP_201_CREATED)


class HorarioDetalleView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, horario_id):
        try:
            horario = Horario.objects.get(pk=horario_id)
        except Horario.DoesNotExist:
            raise ValidationError({'detail': 'El horario no existe.'})
        serializador = HorarioSerializer(horario, data=request.data, partial=True)
        serializador.is_valid(raise_exception=True)
        horario = serializador.save()
        return Response(HorarioSerializer(horario).data)

    def delete(self, request, horario_id):
        eliminados, _ = Horario.objects.filter(pk=horario_id).delete()
        if not eliminados:
            raise ValidationError({'detail': 'El horario no existe.'})
        return Response(status=status.HTTP_204_NO_CONTENT)


class HorarioCitasView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, horario_id):
        try:
            horario = Horario.objects.get(pk=horario_id)
        except Horario.DoesNotExist:
            raise ValidationError({'detail': 'El horario no existe.'})
        return Response(detalle_cupos_horario(horario))


class GenerarCuposView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        serializador = GenerarCuposSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        creados = generar_cupos(
            serializador.validated_data['medico'],
            serializador.validated_data['desde'],
            serializador.validated_data['hasta'],
        )
        return Response({'cupos_creados': creados})
