from django.utils import timezone
from rest_framework import serializers

from apps.login.models import Medico

from .models import Cita, Horario
from .services import dias_habiles, validar_horario_sin_cruce


class HorarioSerializer(serializers.ModelSerializer):
    medico_nombre = serializers.SerializerMethodField()
    medico_documento = serializers.CharField(source='medico.numero_documento', read_only=True)
    clasificacion = serializers.CharField(read_only=True)
    dia_nombre = serializers.CharField(source='get_dia_semana_display', read_only=True)

    class Meta:
        model = Horario
        fields = [
            'id',
            'medico',
            'medico_nombre',
            'medico_documento',
            'fecha',
            'dia_semana',
            'dia_nombre',
            'hora_inicio',
            'hora_fin',
            'duracion_minutos',
            'activo',
            'publicada',
            'clasificacion',
        ]
        read_only_fields = ['dia_semana', 'publicada']

    def get_medico_nombre(self, horario):
        usuario = horario.medico.usuario
        return usuario.get_full_name()

    def validate_duracion_minutos(self, value):
        if value < 10 or value > 120:
            raise serializers.ValidationError('La duración de cada cupo debe ser entre 10 y 120 minutos.')
        return value

    def validate_fecha(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError('Realiza una asignación para una fecha posterior a la actual.')
        return value

    def validate(self, attrs):
        inicio = attrs.get('hora_inicio', getattr(self.instance, 'hora_inicio', None))
        fin = attrs.get('hora_fin', getattr(self.instance, 'hora_fin', None))
        if inicio and fin and fin <= inicio:
            raise serializers.ValidationError({'hora_fin': 'La hora final debe ser posterior a la inicial.'})
        medico = attrs.get('medico', getattr(self.instance, 'medico', None))
        fecha = attrs.get('fecha', getattr(self.instance, 'fecha', None))
        if medico and fecha and inicio and fin:
            validar_horario_sin_cruce(
                medico,
                fecha,
                inicio,
                fin,
                excluir_id=getattr(self.instance, 'pk', None),
            )
        return attrs


class CitaSerializer(serializers.ModelSerializer):
    medico_nombre = serializers.SerializerMethodField()
    paciente_nombre = serializers.SerializerMethodField()
    especialidad = serializers.CharField(source='medico.especialidad', read_only=True)
    oportunidad_dias_habiles = serializers.SerializerMethodField()

    class Meta:
        model = Cita
        fields = [
            'id',
            'medico',
            'medico_nombre',
            'especialidad',
            'paciente',
            'paciente_nombre',
            'solicitante',
            'inicio',
            'fin',
            'estado',
            'motivo',
            'canal',
            'lease_expires_at',
            'fecha_solicitud',
            'fecha_asignacion',
            'oportunidad_dias_habiles',
        ]

    def get_medico_nombre(self, cita):
        return cita.medico.usuario.get_full_name()

    def get_paciente_nombre(self, cita):
        if cita.paciente_id:
            return cita.paciente.nombre_completo
        return None

    def get_oportunidad_dias_habiles(self, cita):
        return dias_habiles(cita.fecha_solicitud, cita.fecha_asignacion)


class CupoBloqueadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cita
        fields = ['id', 'medico', 'inicio', 'fin', 'estado', 'lease_expires_at']


class GenerarCuposSerializer(serializers.Serializer):
    medico = serializers.PrimaryKeyRelatedField(queryset=Medico.objects.filter(activo=True))
    desde = serializers.DateField()
    hasta = serializers.DateField()
