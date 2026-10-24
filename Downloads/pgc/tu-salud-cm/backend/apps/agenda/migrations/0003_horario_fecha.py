from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone


def rellenar_fechas(apps, schema_editor):
    Horario = apps.get_model('agenda', 'Horario')
    hoy = timezone.localdate()
    for horario in Horario.objects.all():
        if horario.fecha:
            continue
        desplazamiento = (horario.dia_semana - hoy.weekday()) % 7
        horario.fecha = hoy + timedelta(days=desplazamiento)
        horario.save(update_fields=['fecha'])


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='horario',
            name='fecha',
            field=models.DateField(null=True),
        ),
        migrations.AddField(
            model_name='horario',
            name='publicada',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(rellenar_fechas, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='horario',
            name='fecha',
            field=models.DateField(),
        ),
        migrations.RemoveConstraint(
            model_name='horario',
            name='horario_unico_inicio',
        ),
        migrations.AddConstraint(
            model_name='horario',
            constraint=models.UniqueConstraint(
                fields=('medico', 'fecha', 'hora_inicio'),
                name='horario_unico_fecha_inicio',
            ),
        ),
        migrations.AlterModelOptions(
            name='horario',
            options={
                'ordering': ['fecha', 'hora_inicio', 'medico'],
                'verbose_name': 'horario',
                'verbose_name_plural': 'horarios',
            },
        ),
    ]
