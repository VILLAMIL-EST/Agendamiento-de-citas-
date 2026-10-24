from rest_framework import serializers

from .models import ResultadoClinico


class ResultadoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(source='paciente.nombre_completo', read_only=True)
    medico_nombre = serializers.SerializerMethodField()
    numero_documento = serializers.CharField(source='paciente.numero_documento', read_only=True)

    class Meta:
        model = ResultadoClinico
        fields = [
            'id',
            'titulo',
            'tipo',
            'fecha_resultado',
            'paciente',
            'paciente_nombre',
            'numero_documento',
            'medico',
            'medico_nombre',
            'cita',
            'cifrado',
            'creado',
        ]

    def get_medico_nombre(self, resultado):
        return resultado.medico.usuario.get_full_name()
