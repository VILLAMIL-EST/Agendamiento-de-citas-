import uuid
from pathlib import Path

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def _crear(self, email, password, **extra):
        if not email:
            raise ValueError('El correo electrónico es obligatorio.')
        email = self.normalize_email(email)
        extra.setdefault('username', email)
        usuario = self.model(email=email, **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._crear(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('rol', Usuario.Rol.ADMIN)
        extra.setdefault('estado', Usuario.EstadoCuenta.ACTIVO)
        extra.setdefault('email_verificado', True)
        extra.setdefault('consentimiento_datos', True)
        extra.setdefault('consentimiento_fecha', timezone.now())
        if extra.get('is_staff') is not True or extra.get('is_superuser') is not True:
            raise ValueError('El superusuario requiere is_staff e is_superuser.')
        return self._crear(email, password, **extra)


class Usuario(AbstractUser):
    """Usuario único del sistema. El rol viaja dentro del JWT."""

    class Rol(models.TextChoices):
        PACIENTE = 'paciente', 'Paciente'
        MEDICO = 'medico', 'Médico'
        ADMIN = 'admin', 'Administrador'

    class EstadoCuenta(models.TextChoices):
        PENDIENTE_VERIFICACION = 'pendiente_verificacion', 'Pendiente de verificación'
        PENDIENTE_APROBACION = 'pendiente_aprobacion', 'Pendiente de aprobación'
        ACTIVO = 'activo', 'Activo'
        RECHAZADO = 'rechazado', 'Rechazado'

    email = models.EmailField('correo', unique=True)
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.PACIENTE)
    email_verificado = models.BooleanField(default=False)
    estado = models.CharField(
        max_length=32,
        choices=EstadoCuenta.choices,
        default=EstadoCuenta.PENDIENTE_VERIFICACION,
    )
    # Se guarda el hash del token, no el valor que viaja en el enlace.
    token_verificacion = models.CharField(max_length=64, null=True, blank=True)
    token_expira = models.DateTimeField(null=True, blank=True)
    aprobado_por = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cuentas_decididas',
    )
    fecha_aprobacion = models.DateTimeField(null=True, blank=True)
    motivo_rechazo = models.TextField(blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    # Ley 1581: el registro del paciente exige consentimiento previo, expreso e informado.
    consentimiento_datos = models.BooleanField(default=False)
    consentimiento_fecha = models.DateTimeField(null=True, blank=True)
    # 2FA TOTP. El secreto no se expone en los serializadores.
    otp_secret = models.CharField(max_length=64, blank=True)
    otp_enabled = models.BooleanField(default=False)
    # HU-003: bloqueo tras tres intentos fallidos.
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UsuarioManager()

    class Meta:
        verbose_name = 'usuario'
        verbose_name_plural = 'usuarios'
        indexes = [
            models.Index(fields=['estado'], name='cuentas_usu_estado_idx'),
            models.Index(fields=['token_verificacion'], name='cuentas_usu_token_idx'),
        ]

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email)
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.get_full_name()} <{self.email}>'

    @property
    def is_patient(self):
        return self.rol == self.Rol.PACIENTE

    @property
    def is_doctor(self):
        return self.rol == self.Rol.MEDICO

    @property
    def is_admin(self):
        return self.rol == self.Rol.ADMIN or self.is_superuser

    @property
    def esta_bloqueado(self):
        return bool(self.locked_until and self.locked_until > timezone.now())


class Paciente(models.Model):
    """
    Perfil clínico-administrativo del paciente.

    Un menor no tiene usuario propio: queda colgado del tutor mediante
    una llave foránea jerárquica. Así el tutor agenda y consulta resultados
    sin duplicar la identidad del acudiente.
    """

    class TipoDocumento(models.TextChoices):
        CC = 'CC', 'Cédula de ciudadanía'
        TI = 'TI', 'Tarjeta de identidad'
        RC = 'RC', 'Registro civil'
        CE = 'CE', 'Cédula de extranjería'

    usuario = models.OneToOneField(
        Usuario,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='perfil_paciente',
    )
    tutor = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='menores',
    )
    nombres = models.CharField(max_length=80)
    apellidos = models.CharField(max_length=80)
    tipo_documento = models.CharField(max_length=4, choices=TipoDocumento.choices)
    numero_documento = models.CharField(max_length=20, unique=True)
    fecha_nacimiento = models.DateField()
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'paciente'
        verbose_name_plural = 'pacientes'
        constraints = [
            # Adulto: tiene usuario y no tiene tutor.
            # Menor: tiene tutor y no tiene usuario propio.
            models.CheckConstraint(
                check=(
                    models.Q(usuario__isnull=False, tutor__isnull=True)
                    | models.Q(usuario__isnull=True, tutor__isnull=False)
                ),
                name='paciente_adulto_o_menor',
            ),
        ]

    def __str__(self):
        return f'{self.nombres} {self.apellidos}'

    @property
    def es_menor(self):
        return self.tutor_id is not None

    @property
    def nombre_completo(self):
        return f'{self.nombres} {self.apellidos}'


class Medico(models.Model):
    """Profesional de medicina general habilitado para el canal web."""

    usuario = models.OneToOneField(
        Usuario,
        on_delete=models.CASCADE,
        related_name='perfil_medico',
    )
    registro_medico = models.CharField(max_length=30, unique=True)
    numero_documento = models.CharField(max_length=20, unique=True)
    especialidad = models.CharField(max_length=80, default='Medicina general')
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'médico'
        verbose_name_plural = 'médicos'

    def __str__(self):
        return f'{self.usuario.get_full_name()} — {self.especialidad}'


class AuditoriaAcceso(models.Model):
    """Traza de accesos exigida por el tratamiento de datos sensibles (Ley 1581)."""

    usuario = models.ForeignKey(
        Usuario,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='auditorias',
    )
    accion = models.CharField(max_length=80)
    recurso = models.CharField(max_length=160, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    detalle = models.CharField(max_length=240, blank=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'auditoría de acceso'
        verbose_name_plural = 'auditorías de acceso'
        ordering = ['-creado']
        indexes = [
            models.Index(fields=['accion', 'creado']),
        ]

    def __str__(self):
        return f'{self.accion} {self.creado:%Y-%m-%d %H:%M}'


def ruta_soporte_tutela(instance, filename):
    extension = Path(filename or '').suffix.lower()
    if extension not in {'.pdf', '.jpg', '.jpeg', '.png', '.webp'}:
        extension = '.bin'
    return f'tutelas/{instance.tutor_id}/{uuid.uuid4().hex}{extension}'


class SolicitudTutela(models.Model):
    """
    Petición del titular para quedar como tutor de un menor.

    El perfil del menor no se crea hasta que administración valide el
    documento (foto o PDF de TI o registro civil).
    """

    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        APROBADA = 'aprobada', 'Aprobada'
        RECHAZADA = 'rechazada', 'Rechazada'

    class TipoSoporte(models.TextChoices):
        PDF = 'pdf', 'PDF'
        IMAGEN = 'imagen', 'Imagen'

    tutor = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name='solicitudes_tutela',
    )
    menor = models.OneToOneField(
        Paciente,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='solicitud_tutela',
    )
    nombres = models.CharField(max_length=80)
    apellidos = models.CharField(max_length=80)
    tipo_documento = models.CharField(max_length=4, choices=Paciente.TipoDocumento.choices)
    numero_documento = models.CharField(max_length=20)
    fecha_nacimiento = models.DateField()
    soporte = models.FileField(upload_to=ruta_soporte_tutela)
    tipo_soporte = models.CharField(
        max_length=10,
        choices=TipoSoporte.choices,
        default=TipoSoporte.PDF,
    )
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.PENDIENTE)
    motivo_rechazo = models.TextField(blank=True)
    aprobado_por = models.ForeignKey(
        Usuario,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='tutelas_decididas',
    )
    fecha_decision = models.DateTimeField(null=True, blank=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'solicitud de tutela'
        verbose_name_plural = 'solicitudes de tutela'
        ordering = ['-creado']
        constraints = [
            models.UniqueConstraint(
                fields=['numero_documento'],
                condition=models.Q(estado='pendiente'),
                name='tutela_pendiente_documento_unico',
            ),
        ]
        indexes = [
            models.Index(fields=['estado', 'creado']),
            models.Index(fields=['numero_documento']),
        ]

    def __str__(self):
        return f'{self.nombres} {self.apellidos} ({self.estado})'

    @property
    def nombre_completo(self):
        return f'{self.nombres} {self.apellidos}'
