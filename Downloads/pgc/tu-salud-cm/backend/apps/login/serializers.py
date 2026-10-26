from datetime import date

from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from .models import Medico, Paciente, SolicitudTutela, Usuario
from .soporte import validar_soporte


def edad_en(fecha_nacimiento, hoy=None):
    hoy = hoy or timezone.localdate()
    return hoy.year - fecha_nacimiento.year - (
        (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )


class UsuarioSerializer(serializers.ModelSerializer):
    nombres = serializers.CharField(source='first_name')
    apellidos = serializers.CharField(source='last_name')
    is_patient = serializers.BooleanField(read_only=True)
    is_doctor = serializers.BooleanField(read_only=True)
    is_admin = serializers.BooleanField(read_only=True)
    numero_documento = serializers.SerializerMethodField()
    paciente_id = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            'id',
            'email',
            'nombres',
            'apellidos',
            'rol',
            'telefono',
            'is_patient',
            'is_doctor',
            'is_admin',
            'otp_enabled',
            'numero_documento',
            'paciente_id',
        ]

    def get_paciente_id(self, usuario):
        perfil = getattr(usuario, 'perfil_paciente', None)
        return perfil.id if perfil else None

    def get_numero_documento(self, usuario):
        perfil = getattr(usuario, 'perfil_paciente', None)
        if perfil:
            return perfil.numero_documento
        medico = getattr(usuario, 'perfil_medico', None)
        if medico:
            return medico.numero_documento
        return None


class RegistroPacienteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    nombres = serializers.CharField(max_length=80)
    apellidos = serializers.CharField(max_length=80)
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True)
    tipo_documento = serializers.ChoiceField(choices=Paciente.TipoDocumento.choices)
    numero_documento = serializers.RegexField(r'^\d{5,12}$')
    fecha_nacimiento = serializers.DateField()
    consentimiento_datos = serializers.BooleanField()

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Ya existe una cuenta con ese correo.')
        return value.lower()

    def validate_numero_documento(self, value):
        if Paciente.objects.filter(numero_documento=value).exists():
            raise serializers.ValidationError('Ese documento ya está registrado.')
        return value

    def validate_fecha_nacimiento(self, value):
        if value > date.today():
            raise serializers.ValidationError('La fecha de nacimiento no es válida.')
        if edad_en(value) < 18:
            raise serializers.ValidationError(
                'El titular de la cuenta debe ser mayor de edad. Un menor se registra a cargo de su tutor.'
            )
        return value

    def validate_consentimiento_datos(self, value):
        if not value:
            raise serializers.ValidationError(
                'Debe autorizar el tratamiento de datos personales para crear la cuenta (Ley 1581 de 2012).'
            )
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated):
        usuario = Usuario.objects.create_user(
            email=validated['email'],
            password=validated['password'],
            first_name=validated['nombres'].strip(),
            last_name=validated['apellidos'].strip(),
            telefono=validated.get('telefono', ''),
            rol=Usuario.Rol.PACIENTE,
            estado=Usuario.EstadoCuenta.PENDIENTE_VERIFICACION,
            email_verificado=False,
            consentimiento_datos=True,
            consentimiento_fecha=timezone.now(),
        )
        Paciente.objects.create(
            usuario=usuario,
            nombres=usuario.first_name,
            apellidos=usuario.last_name,
            tipo_documento=validated['tipo_documento'],
            numero_documento=validated['numero_documento'],
            fecha_nacimiento=validated['fecha_nacimiento'],
        )
        return usuario


class MenorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paciente
        fields = [
            'id',
            'nombres',
            'apellidos',
            'tipo_documento',
            'numero_documento',
            'fecha_nacimiento',
        ]
        read_only_fields = ['id']

    def validate_tipo_documento(self, value):
        if value not in (Paciente.TipoDocumento.TI, Paciente.TipoDocumento.RC):
            raise serializers.ValidationError('Un menor se registra con tarjeta de identidad o registro civil.')
        return value

    def validate_fecha_nacimiento(self, value):
        if value > date.today() or edad_en(value) >= 18:
            raise serializers.ValidationError('La fecha no corresponde a un menor de edad.')
        return value

    def validate_numero_documento(self, value):
        consulta = Paciente.objects.filter(numero_documento=value)
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Ese documento ya está registrado.')
        return value


class SolicitudTutelaSerializer(serializers.ModelSerializer):
    tutor_nombre = serializers.SerializerMethodField()
    tutor_documento = serializers.SerializerMethodField()
    clasificacion = serializers.SerializerMethodField()
    tiene_soporte = serializers.SerializerMethodField()
    soporte = serializers.FileField(write_only=True)

    class Meta:
        model = SolicitudTutela
        fields = [
            'id',
            'nombres',
            'apellidos',
            'tipo_documento',
            'numero_documento',
            'fecha_nacimiento',
            'soporte',
            'tipo_soporte',
            'estado',
            'clasificacion',
            'motivo_rechazo',
            'fecha_decision',
            'creado',
            'tutor_nombre',
            'tutor_documento',
            'tiene_soporte',
        ]
        read_only_fields = [
            'id',
            'tipo_soporte',
            'estado',
            'clasificacion',
            'motivo_rechazo',
            'fecha_decision',
            'creado',
            'tutor_nombre',
            'tutor_documento',
            'tiene_soporte',
        ]

    def get_tutor_nombre(self, solicitud):
        return solicitud.tutor.nombre_completo

    def get_tutor_documento(self, solicitud):
        return solicitud.tutor.numero_documento

    def get_clasificacion(self, solicitud):
        if solicitud.estado == SolicitudTutela.Estado.APROBADA:
            return 'activo'
        if solicitud.estado == SolicitudTutela.Estado.RECHAZADA:
            return 'rechazado'
        return 'pendiente'

    def get_tiene_soporte(self, solicitud):
        return bool(solicitud.soporte)

    def validate_tipo_documento(self, value):
        if value not in (Paciente.TipoDocumento.TI, Paciente.TipoDocumento.RC):
            raise serializers.ValidationError('Un menor se registra con tarjeta de identidad o registro civil.')
        return value

    def validate_fecha_nacimiento(self, value):
        if value > date.today() or edad_en(value) >= 18:
            raise serializers.ValidationError('La fecha no corresponde a un menor de edad.')
        return value

    def validate_numero_documento(self, value):
        if Paciente.objects.filter(numero_documento=value).exists():
            raise serializers.ValidationError('Ese documento ya está registrado.')
        if SolicitudTutela.objects.filter(
            numero_documento=value,
            estado=SolicitudTutela.Estado.PENDIENTE,
        ).exists():
            raise serializers.ValidationError('Ya hay una solicitud pendiente con ese documento.')
        return value

    def validate_soporte(self, archivo):
        self._tipo_soporte = validar_soporte(archivo)
        return archivo

    def create(self, validated):
        tutor = self.context['tutor']
        tipo = getattr(self, '_tipo_soporte', SolicitudTutela.TipoSoporte.PDF)
        return SolicitudTutela.objects.create(
            tutor=tutor,
            tipo_soporte=tipo,
            **validated,
        )


class MedicoAltaSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    nombres = serializers.CharField(max_length=80)
    apellidos = serializers.CharField(max_length=80)
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True)
    numero_documento = serializers.RegexField(r'^\d{5,12}$')
    registro_medico = serializers.CharField(max_length=30)
    especialidad = serializers.CharField(max_length=80, required=False, default='Medicina general')

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Ya existe una cuenta con ese correo.')
        return value.lower()

    def validate_numero_documento(self, value):
        if Medico.objects.filter(numero_documento=value).exists():
            raise serializers.ValidationError('Ese documento ya está registrado.')
        return value

    def validate_registro_medico(self, value):
        if Medico.objects.filter(registro_medico__iexact=value).exists():
            raise serializers.ValidationError('Ese registro médico ya está asignado.')
        return value.strip()

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated):
        usuario = Usuario.objects.create_user(
            email=validated['email'],
            password=validated['password'],
            first_name=validated['nombres'].strip(),
            last_name=validated['apellidos'].strip(),
            telefono=validated.get('telefono', ''),
            rol=Usuario.Rol.MEDICO,
            estado=Usuario.EstadoCuenta.ACTIVO,
            email_verificado=True,
            consentimiento_datos=True,
            consentimiento_fecha=timezone.now(),
        )
        Medico.objects.create(
            usuario=usuario,
            numero_documento=validated['numero_documento'],
            registro_medico=validated['registro_medico'],
            especialidad=validated.get('especialidad') or 'Medicina general',
        )
        return usuario


class MedicoSerializer(serializers.ModelSerializer):
    nombres = serializers.CharField(source='usuario.first_name', read_only=True)
    apellidos = serializers.CharField(source='usuario.last_name', read_only=True)
    email = serializers.EmailField(source='usuario.email', read_only=True)

    class Meta:
        model = Medico
        fields = [
            'id',
            'nombres',
            'apellidos',
            'email',
            'numero_documento',
            'registro_medico',
            'especialidad',
            'activo',
        ]
