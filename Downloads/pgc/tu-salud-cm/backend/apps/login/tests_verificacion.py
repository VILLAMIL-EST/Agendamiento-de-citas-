from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Paciente, Usuario


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'registro'}},
    DEBUG=True,
)
class VerificacionCuentaTests(TestCase):
    def setUp(self):
        self.cliente = APIClient()
        self.admin = Usuario.objects.create_user(
            'admin@tusalud.local',
            'Admin123*',
            first_name='Laura',
            last_name='Sierra',
            rol=Usuario.Rol.ADMIN,
            estado=Usuario.EstadoCuenta.ACTIVO,
            email_verificado=True,
        )
        self.payload = {
            'email': 'nuevo@tusalud.local',
            'password': 'Paciente123*',
            'nombres': 'Nora',
            'apellidos': 'Diaz',
            'telefono': '3000000000',
            'tipo_documento': 'CC',
            'numero_documento': '4455667788',
            'fecha_nacimiento': '1994-02-02',
            'consentimiento_datos': True,
        }

    def test_el_flujo_completo_exige_correo_y_aprobacion(self):
        alta = self.cliente.post('/api/auth/registro/', self.payload, format='json')
        self.assertEqual(alta.status_code, 201)
        self.assertNotIn('access', alta.data)
        self.assertEqual(len(mail.outbox), 1)

        bloqueado = self.cliente.post(
            '/api/auth/login/',
            {'email': self.payload['email'], 'password': self.payload['password']},
            format='json',
        )
        self.assertEqual(bloqueado.status_code, 403)
        self.assertEqual(bloqueado.data['detail'], 'Debes confirmar tu correo electrónico')

        token = alta.data['enlace_debug'].rstrip('/').split('/')[-1]
        confirmacion = self.cliente.get(f'/api/auth/verificar-email/{token}/')
        self.assertEqual(confirmacion.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

        repetido = self.cliente.get(f'/api/auth/verificar-email/{token}/')
        self.assertEqual(repetido.status_code, 400)

        en_revision = self.cliente.post(
            '/api/auth/login/',
            {'email': self.payload['email'], 'password': self.payload['password']},
            format='json',
        )
        self.assertEqual(en_revision.data['detail'], 'Tu cuenta está en revisión por un administrador')

        self.cliente.force_authenticate(self.admin)
        lista = self.cliente.get('/api/auth/solicitudes/')
        self.assertEqual(lista.status_code, 200)
        self.assertEqual(len(lista.data), 1)
        usuario_id = lista.data[0]['id']

        aprobado = self.cliente.post(f'/api/auth/solicitudes/{usuario_id}/aprobar/', {}, format='json')
        self.assertEqual(aprobado.status_code, 200)
        self.assertEqual(len(mail.outbox), 3)

        cuenta = Usuario.objects.get(email=self.payload['email'])
        self.assertEqual(cuenta.estado, Usuario.EstadoCuenta.ACTIVO)
        self.assertEqual(cuenta.aprobado_por_id, self.admin.id)
        self.assertIsNotNone(cuenta.fecha_aprobacion)
        self.assertTrue(Paciente.objects.filter(usuario=cuenta).exists())

        self.cliente.force_authenticate(user=None)
        ingreso = self.cliente.post(
            '/api/auth/login/',
            {'email': self.payload['email'], 'password': self.payload['password']},
            format='json',
        )
        self.assertEqual(ingreso.status_code, 200)
        self.assertIn('access', ingreso.data)

        por_cedula = self.cliente.post(
            '/api/auth/login/',
            {'identificador': self.payload['numero_documento'], 'password': self.payload['password']},
            format='json',
        )
        self.assertEqual(por_cedula.status_code, 200)
        self.assertIn('access', por_cedula.data)

        self.cliente.force_authenticate(self.admin)
        historial = self.cliente.get('/api/auth/solicitudes/', {'vista': 'historial'})
        self.assertEqual(historial.status_code, 200)
        registro = next(item for item in historial.data if item['email'] == self.payload['email'])
        self.assertEqual(registro['clasificacion'], 'activo')
        self.assertEqual(registro['numero_documento'], self.payload['numero_documento'])
        self.cliente.force_authenticate(user=None)

    def test_el_rechazo_avisa_al_usuario_y_bloquea_el_ingreso(self):
        alta = self.cliente.post('/api/auth/registro/', self.payload, format='json')
        token = alta.data['enlace_debug'].rstrip('/').split('/')[-1]
        self.cliente.get(f'/api/verificar-email/{token}/')
        self.cliente.force_authenticate(self.admin)
        usuario = Usuario.objects.get(email=self.payload['email'])
        respuesta = self.cliente.post(
            f'/api/admin/solicitudes/{usuario.id}/rechazar/',
            {'motivo': 'Documento ilegible'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, 200)
        self.cliente.force_authenticate(user=None)
        ingreso = self.cliente.post(
            '/api/auth/login/',
            {'email': self.payload['email'], 'password': self.payload['password']},
            format='json',
        )
        self.assertIn('Tu cuenta fue rechazada', ingreso.data['detail'])
        self.assertIn('Documento ilegible', ingreso.data['detail'])
        self.assertIsNotNone(Usuario.objects.get(pk=usuario.id).fecha_aprobacion)
