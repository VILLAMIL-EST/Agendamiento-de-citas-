import io
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.login.models import Medico, Paciente, Usuario

from .models import Cita, Horario
from .services import bloquear_cupo, confirmar_cupo, generar_cupos, liberar_leases_expirados


@override_settings(CACHES={
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'pruebas-lease',
    }
})
class LeasePatternTests(TestCase):
    def setUp(self):
        self.medico_usuario = Usuario.objects.create_user(
            'medico@tusalud.local',
            'Medico123*',
            first_name='Ana',
            last_name='Rojas',
            rol=Usuario.Rol.MEDICO,
        )
        self.medico = Medico.objects.create(
            usuario=self.medico_usuario,
            registro_medico='RM-100',
            numero_documento='900000001',
        )
        self.ana = self._paciente('ana@tusalud.local', 'Ana', 'Paz', '100000001')
        self.luis = self._paciente('luis@tusalud.local', 'Luis', 'Diaz', '100000002')
        inicio = timezone.now() + timedelta(days=2)
        self.cita = Cita.objects.create(
            medico=self.medico,
            inicio=inicio,
            fin=inicio + timedelta(minutes=20),
        )

    def _paciente(self, email, nombres, apellidos, documento):
        usuario = Usuario.objects.create_user(
            email,
            'Paciente123*',
            first_name=nombres,
            last_name=apellidos,
            rol=Usuario.Rol.PACIENTE,
            consentimiento_datos=True,
        )
        return Paciente.objects.create(
            usuario=usuario,
            nombres=nombres,
            apellidos=apellidos,
            tipo_documento=Paciente.TipoDocumento.CC,
            numero_documento=documento,
            fecha_nacimiento='1992-04-12',
        )

    def test_dos_pacientes_no_pueden_tomar_el_mismo_cupo(self):
        bloqueada = bloquear_cupo(self.cita.id, self.ana.usuario)
        self.assertEqual(bloqueada.estado, Cita.Estado.BLOQUEADO)
        self.assertIsNotNone(bloqueada.lease_expires_at)

        with self.assertRaises(ValidationError):
            bloquear_cupo(self.cita.id, self.luis.usuario)

        self.cita.refresh_from_db()
        self.assertEqual(self.cita.leased_by_id, self.ana.usuario_id)

    def test_el_arrendamiento_vencido_vuelve_a_estar_disponible(self):
        cita = bloquear_cupo(self.cita.id, self.ana.usuario)
        cita.lease_expires_at = timezone.now() - timedelta(minutes=1)
        cita.save(update_fields=['lease_expires_at'])

        liberados = liberar_leases_expirados()
        self.assertEqual(liberados, 1)
        cita.refresh_from_db()
        self.assertEqual(cita.estado, Cita.Estado.DISPONIBLE)
        self.assertIsNone(cita.leased_by_id)

        tomada = bloquear_cupo(cita.id, self.luis.usuario)
        self.assertEqual(tomada.leased_by_id, self.luis.usuario_id)

    def test_solo_quien_arrendo_puede_confirmar(self):
        bloquear_cupo(self.cita.id, self.ana.usuario)
        with self.assertRaises(ValidationError):
            confirmar_cupo(self.cita.id, self.luis.usuario, self.luis.id, 'Control')

        confirmada = confirmar_cupo(self.cita.id, self.ana.usuario, self.ana.id, 'Control')
        self.assertEqual(confirmada.estado, Cita.Estado.CONFIRMADO)
        self.assertEqual(confirmada.paciente_id, self.ana.id)
        self.assertIsNotNone(confirmada.fecha_solicitud)
        self.assertIsNone(confirmada.leased_by_id)

    def test_un_paciente_no_entra_al_endpoint_de_administracion(self):
        cliente = APIClient()
        cliente.force_authenticate(self.ana.usuario)
        respuesta = cliente.get('/api/analitica/resumen/')
        self.assertEqual(respuesta.status_code, 403)
        respuesta_agenda = cliente.get('/api/agenda/horarios/')
        self.assertEqual(respuesta_agenda.status_code, 403)

    def test_abrir_cupos_solo_usa_la_fecha_asignada(self):
        manana = timezone.localdate() + timedelta(days=1)
        otra_semana = manana + timedelta(days=7)
        Horario.objects.create(
            medico=self.medico,
            fecha=manana,
            hora_inicio='07:00',
            hora_fin='08:00',
            duracion_minutos=20,
        )
        Horario.objects.create(
            medico=self.medico,
            fecha=otra_semana,
            hora_inicio='14:00',
            hora_fin='15:00',
            duracion_minutos=20,
        )
        creados = generar_cupos(self.medico, manana, manana)
        self.assertGreater(creados, 0)
        self.assertTrue(
            Horario.objects.get(medico=self.medico, fecha=manana, hora_inicio='07:00').publicada,
        )
        self.assertFalse(
            Horario.objects.get(medico=self.medico, fecha=otra_semana, hora_inicio='14:00').publicada,
        )
        self.assertFalse(
            Cita.objects.filter(medico=self.medico, inicio__date=otra_semana).exists(),
        )


@override_settings(CACHES={
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'pruebas-pdf',
    }
})
class PdfCifradoTests(TestCase):
    def test_el_pdf_se_abre_con_el_documento_del_paciente(self):
        from pypdf import PdfReader, PdfWriter

        from apps.clinica.services import cifrar_pdf

        origen = PdfWriter()
        origen.add_blank_page(width=200, height=200)
        buffer = io.BytesIO()
        origen.write(buffer)
        buffer.seek(0)
        buffer.name = 'reporte.pdf'

        cifrado = cifrar_pdf(buffer, '1234567890')
        lector = PdfReader(io.BytesIO(cifrado))
        self.assertTrue(lector.is_encrypted)
        self.assertEqual(lector.decrypt('1234567890'), 1)
        self.assertEqual(len(lector.pages), 1)
