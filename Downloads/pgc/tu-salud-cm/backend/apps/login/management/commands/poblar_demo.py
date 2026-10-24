from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.agenda.models import Horario
from apps.agenda.services import bloquear_cupo, confirmar_cupo, generar_cupos
from apps.login.models import Medico, Paciente, Usuario


class Command(BaseCommand):
    help = 'Crea usuarios, un horario de medicina general y cupos de demostración.'

    def handle(self, *args, **options):
        admin, _ = self._usuario(
            'admin@tusalud.local',
            'Admin123*',
            'Laura',
            'Sierra',
            Usuario.Rol.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        medico_usuario, _ = self._usuario(
            'medico@tusalud.local',
            'Medico123*',
            'Ana',
            'Rojas',
            Usuario.Rol.MEDICO,
        )
        medico, _ = Medico.objects.get_or_create(
            usuario=medico_usuario,
            defaults={
                'registro_medico': 'RM-1001',
                'numero_documento': '800000001',
                'especialidad': 'Medicina general',
            },
        )
        paciente_usuario, _ = self._usuario(
            'paciente@tusalud.local',
            'Paciente123*',
            'Carlos',
            'Mendez',
            Usuario.Rol.PACIENTE,
        )
        paciente, _ = Paciente.objects.get_or_create(
            numero_documento='1010101010',
            defaults={
                'usuario': paciente_usuario,
                'nombres': 'Carlos',
                'apellidos': 'Mendez',
                'tipo_documento': Paciente.TipoDocumento.CC,
                'fecha_nacimiento': '1990-03-15',
            },
        )
        Paciente.objects.get_or_create(
            numero_documento='1098765432',
            defaults={
                'tutor': paciente,
                'nombres': 'Sofia',
                'apellidos': 'Mendez',
                'tipo_documento': Paciente.TipoDocumento.TI,
                'fecha_nacimiento': '2016-08-20',
            },
        )
        hoy = timezone.localdate()
        for desplazamiento in range(0, 5):
            fecha = hoy + timedelta(days=desplazamiento)
            if fecha.weekday() >= 5:
                continue
            Horario.objects.get_or_create(
                medico=medico,
                fecha=fecha,
                hora_inicio='08:00',
                defaults={
                    'hora_fin': '12:00',
                    'duracion_minutos': 20,
                    'activo': True,
                },
            )
        creados = generar_cupos(medico, hoy, hoy + timedelta(days=6))
        self.stdout.write(self.style.SUCCESS(f'Cupos nuevos: {creados}'))

        if not paciente.citas.filter(estado='confirmado').exists():
            cupo = medico.citas.filter(estado='disponible', inicio__gt=timezone.now()).order_by('inicio').first()
            if cupo:
                bloquear_cupo(cupo.id, paciente_usuario)
                confirmar_cupo(cupo.id, paciente_usuario, paciente.id, 'Control de medicina general')

        self.stdout.write('Administración: admin@tusalud.local / Admin123*')
        self.stdout.write('Médico: medico@tusalud.local / Medico123*')
        self.stdout.write('Paciente: paciente@tusalud.local / Paciente123*')
        self.stdout.write(f'Listo. Admin id={admin.id}, médico id={medico.id}.')

    def _usuario(self, email, password, nombres, apellidos, rol, **extra):
        usuario = Usuario.objects.filter(email=email).first()
        if usuario:
            return usuario, False
        usuario = Usuario.objects.create_user(
            email,
            password,
            first_name=nombres,
            last_name=apellidos,
            rol=rol,
            estado=Usuario.EstadoCuenta.ACTIVO,
            email_verificado=True,
            consentimiento_datos=True,
            consentimiento_fecha=timezone.now(),
            **extra,
        )
        return usuario, True
