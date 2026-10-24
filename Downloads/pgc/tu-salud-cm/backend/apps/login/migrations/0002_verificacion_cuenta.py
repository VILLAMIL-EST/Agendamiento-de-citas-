from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cuentas', '0001_initial'),
    ]

    operations = [
        # Las cuentas que ya existen siguen pudiendo entrar.
        migrations.AddField(
            model_name='usuario',
            name='email_verificado',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='estado',
            field=models.CharField(
                choices=[
                    ('pendiente_verificacion', 'Pendiente de verificación'),
                    ('pendiente_aprobacion', 'Pendiente de aprobación'),
                    ('activo', 'Activo'),
                    ('rechazado', 'Rechazado'),
                ],
                default='activo',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='usuario',
            name='token_verificacion',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='token_expira',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='aprobado_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='cuentas_decididas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='usuario',
            name='fecha_aprobacion',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='motivo_rechazo',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='usuario',
            name='email_verificado',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='usuario',
            name='estado',
            field=models.CharField(
                choices=[
                    ('pendiente_verificacion', 'Pendiente de verificación'),
                    ('pendiente_aprobacion', 'Pendiente de aprobación'),
                    ('activo', 'Activo'),
                    ('rechazado', 'Rechazado'),
                ],
                default='pendiente_verificacion',
                max_length=32,
            ),
        ),
        migrations.AddIndex(
            model_name='usuario',
            index=models.Index(fields=['estado'], name='cuentas_usu_estado_idx'),
        ),
        migrations.AddIndex(
            model_name='usuario',
            index=models.Index(fields=['token_verificacion'], name='cuentas_usu_token_idx'),
        ),
    ]
