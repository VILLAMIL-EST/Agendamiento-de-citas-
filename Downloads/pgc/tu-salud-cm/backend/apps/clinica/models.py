from django.db import models


def ruta_resultado(instance, filename):
    # El nombre original del archivo no se conserva: evita rutas manipuladas.
    return f'resultados/{instance.paciente_id}/{instance.fecha_resultado:%Y/%m}/reporte.pdf'


class ResultadoClinico(models.Model):
    """
    Reporte o fórmula en PDF.

    El archivo guardado ya está cifrado. La contraseña de usuario del PDF
    es el número de documento del paciente; la contraseña de propietario
    permanece en el servidor.
    """

    class Tipo(models.TextChoices):
        LABORATORIO = 'laboratorio', 'Laboratorio'
        FORMULA = 'formula', 'Fórmula médica'
        REPORTE = 'reporte', 'Reporte clínico'

    paciente = models.ForeignKey(
        'cuentas.Paciente',
        on_delete=models.PROTECT,
        related_name='resultados',
    )
    medico = models.ForeignKey(
        'cuentas.Medico',
        on_delete=models.PROTECT,
        related_name='resultados',
    )
    cita = models.ForeignKey(
        'agenda.Cita',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resultados',
    )
    titulo = models.CharField(max_length=160)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.REPORTE)
    archivo = models.FileField(upload_to=ruta_resultado)
    cifrado = models.BooleanField(default=True)
    fecha_resultado = models.DateField()
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'resultado clínico'
        verbose_name_plural = 'resultados clínicos'
        ordering = ['-fecha_resultado', '-creado']
        indexes = [
            models.Index(fields=['paciente', 'fecha_resultado']),
        ]

    def __str__(self):
        return f'{self.titulo} — {self.paciente}'
