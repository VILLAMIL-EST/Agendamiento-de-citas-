from django.conf import settings
from django.db import models


class Horario(models.Model):
    """
    Jornada laboral delegada al canal web.

    El paciente no ve la agenda institucional completa: solo los cupos que
    la administración genera a partir de estos horarios.
    """

    class Dia(models.IntegerChoices):
        LUNES = 0, 'Lunes'
        MARTES = 1, 'Martes'
        MIERCOLES = 2, 'Miércoles'
        JUEVES = 3, 'Jueves'
        VIERNES = 4, 'Viernes'
        SABADO = 5, 'Sábado'
        DOMINGO = 6, 'Domingo'

    medico = models.ForeignKey(
        'cuentas.Medico',
        on_delete=models.CASCADE,
        related_name='horarios',
    )
    # La jornada es de un día concreto. El lunes 27 no se mezcla con el lunes 3.
    fecha = models.DateField()
    dia_semana = models.PositiveSmallIntegerField(choices=Dia.choices)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    duracion_minutos = models.PositiveSmallIntegerField(default=20)
    activo = models.BooleanField(default=True)
    # True cuando administración ya materializó cupos para esta fecha.
    publicada = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'horario'
        verbose_name_plural = 'horarios'
        constraints = [
            models.CheckConstraint(
                check=models.Q(hora_fin__gt=models.F('hora_inicio')),
                name='horario_fin_mayor_inicio',
            ),
            models.UniqueConstraint(
                fields=['medico', 'fecha', 'hora_inicio'],
                name='horario_unico_fecha_inicio',
            ),
        ]
        ordering = ['fecha', 'hora_inicio', 'medico']

    def save(self, *args, **kwargs):
        if self.fecha:
            self.dia_semana = self.fecha.weekday()
        super().save(*args, **kwargs)

    @property
    def clasificacion(self):
        from django.utils import timezone

        if self.fecha < timezone.localdate():
            return 'vencida'
        if self.publicada:
            return 'activa'
        return 'propuesta'

    def __str__(self):
        return (
            f'{self.medico} {self.fecha:%Y-%m-%d} '
            f'{self.hora_inicio:%H:%M}-{self.hora_fin:%H:%M}'
        )


class Cita(models.Model):
    """
    Cupo ambulatorio.

    Estados del ciclo de vida:
    disponible -> bloqueado (lease) -> confirmado -> atendido | no_asistio
    Si el paciente cancela, el cupo vuelve a disponible y el hecho queda
    en EventoCita, porque la restricción única (médico, inicio) no permite
    dos filas para el mismo cupo.
    """

    class Estado(models.TextChoices):
        DISPONIBLE = 'disponible', 'Disponible'
        BLOQUEADO = 'bloqueado', 'Bloqueado'
        CONFIRMADO = 'confirmado', 'Confirmado'
        ATENDIDO = 'atendido', 'Atendido'
        NO_ASISTIO = 'no_asistio', 'No asistió'

    medico = models.ForeignKey(
        'cuentas.Medico',
        on_delete=models.PROTECT,
        related_name='citas',
    )
    paciente = models.ForeignKey(
        'cuentas.Paciente',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='citas',
    )
    # Quien opera el canal web. En un menor, el solicitante es el tutor.
    solicitante = models.ForeignKey(
        'cuentas.Paciente',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='citas_solicitadas',
    )
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.DISPONIBLE,
    )
    # Lease Pattern: vencimiento del arrendamiento temporal del cupo.
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    leased_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cupos_arrendados',
    )
    # Resolución 1552: fecha de solicitud y fecha de asignación para medir oportunidad.
    fecha_solicitud = models.DateTimeField(null=True, blank=True)
    fecha_asignacion = models.DateTimeField(null=True, blank=True)
    motivo = models.CharField(max_length=180, blank=True)
    canal = models.CharField(max_length=16, default='web')
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'cita'
        verbose_name_plural = 'citas'
        constraints = [
            models.UniqueConstraint(
                fields=['medico', 'inicio'],
                name='cita_unica_medico_inicio',
            ),
            models.CheckConstraint(
                check=models.Q(fin__gt=models.F('inicio')),
                name='cita_fin_posterior',
            ),
        ]
        indexes = [
            models.Index(fields=['estado', 'lease_expires_at']),
            models.Index(fields=['medico', 'inicio']),
            models.Index(fields=['paciente', 'inicio']),
        ]
        ordering = ['inicio']

    def __str__(self):
        return f'{self.medico_id} {self.inicio:%Y-%m-%d %H:%M} {self.estado}'


class EventoCita(models.Model):
    """Bitácora del cupo: bloqueo, confirmación, cancelación y asistencia."""

    class Tipo(models.TextChoices):
        BLOQUEO = 'bloqueo', 'Bloqueo'
        LIBERACION = 'liberacion', 'Liberación'
        CONFIRMACION = 'confirmacion', 'Confirmación'
        CANCELACION = 'cancelacion', 'Cancelación'
        ATENCION = 'atencion', 'Atención'
        INASISTENCIA = 'inasistencia', 'Inasistencia'

    cita = models.ForeignKey(Cita, on_delete=models.CASCADE, related_name='eventos')
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='eventos_cita',
    )
    paciente = models.ForeignKey(
        'cuentas.Paciente',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='eventos_cita',
    )
    detalle = models.CharField(max_length=240, blank=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado']

    def __str__(self):
        return f'{self.tipo} cita {self.cita_id}'
