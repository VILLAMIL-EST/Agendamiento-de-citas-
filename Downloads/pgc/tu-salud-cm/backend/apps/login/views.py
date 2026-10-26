import base64
import io
from datetime import timedelta

import pyotp
import qrcode
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .auditoria import ip_de, registrar
from .correo import (
    FIRMA_DECISION,
    enviar_aprobacion,
    enviar_aviso_admin,
    enviar_rechazo,
    enviar_verificacion,
)
from .models import Medico, Paciente, SolicitudTutela, Usuario
from .soporte import content_type_soporte
from .verificacion import asignar_token, buscar_por_token, cupo_de_registro
from .permissions import IsAdmin, IsPaciente
from .serializers import (
    MedicoAltaSerializer,
    MedicoSerializer,
    MenorSerializer,
    RegistroPacienteSerializer,
    SolicitudTutelaSerializer,
    UsuarioSerializer,
)
from .tokens import TokenRefresco, token_preautenticacion

FIRMA_RECUPERACION = TimestampSigner(salt='tusalud-recuperar-clave')


def _respuesta_sesion(usuario, request):
    refresco = TokenRefresco.for_user(usuario)
    respuesta = Response(
        {
            'access': str(refresco.access_token),
            'usuario': UsuarioSerializer(usuario).data,
        }
    )
    respuesta.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresco),
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path=settings.REFRESH_COOKIE_PATH,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
    )
    registrar(request, 'login_exitoso', usuario=usuario)
    return respuesta


def _borrar_cookie(respuesta):
    respuesta.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
    )
    return respuesta


def _mensaje_estado(usuario):
    mensajes = {
        Usuario.EstadoCuenta.PENDIENTE_VERIFICACION: 'Debes confirmar tu correo electrónico',
        Usuario.EstadoCuenta.PENDIENTE_APROBACION: 'Tu cuenta está en revisión por un administrador',
        Usuario.EstadoCuenta.RECHAZADO: 'Tu cuenta fue rechazada',
    }
    detalle = mensajes.get(usuario.estado, 'La cuenta no está habilitada para ingresar.')
    if usuario.estado == Usuario.EstadoCuenta.RECHAZADO and usuario.motivo_rechazo:
        detalle = f'{detalle}. Motivo: {usuario.motivo_rechazo}'
    return detalle


def _respuesta_registro(enlace):
    cuerpo = {
        'detail': 'Cuenta creada. Revisa tu correo para confirmarla. Hasta entonces no puedes iniciar sesión.',
        'estado': Usuario.EstadoCuenta.PENDIENTE_VERIFICACION,
    }
    if settings.DEBUG:
        cuerpo['enlace_debug'] = enlace
    return Response(cuerpo, status=status.HTTP_201_CREATED)


class RegistroView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not cupo_de_registro(ip_de(request)):
            return Response(
                {'detail': 'Demasiados registros desde esta red. Intente de nuevo más tarde.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        email = str(request.data.get('email', '')).strip().lower()
        existente = Usuario.objects.filter(email__iexact=email).first()
        if existente and existente.estado == Usuario.EstadoCuenta.PENDIENTE_VERIFICACION:
            token = asignar_token(existente)
            enlace = enviar_verificacion(existente, token)
            registrar(request, 'verificacion_reenviada', usuario=existente)
            return _respuesta_registro(enlace)

        serializador = RegistroPacienteSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        usuario = serializador.save()
        token = asignar_token(usuario)
        enlace = enviar_verificacion(usuario, token)
        registrar(request, 'registro_paciente', usuario=usuario)
        return _respuesta_registro(enlace)


def buscar_usuario_por_identificador(valor):
    """Localiza la cuenta por correo o por número de documento."""
    identificador = str(valor or '').strip()
    if not identificador:
        return None
    if '@' in identificador:
        return Usuario.objects.filter(email__iexact=identificador).first()

    documento = ''.join(caracter for caracter in identificador if caracter.isdigit())
    if documento:
        paciente = (
            Paciente.objects.filter(numero_documento=documento, usuario__isnull=False)
            .select_related('usuario')
            .first()
        )
        if paciente:
            return paciente.usuario
        medico = (
            Medico.objects.filter(numero_documento=documento)
            .select_related('usuario')
            .first()
        )
        if medico:
            return medico.usuario
    return Usuario.objects.filter(email__iexact=identificador).first()


class LoginView(APIView):
    """
    Valida correo o cédula, y luego la contraseña.

    El documento de grado separa el error de usuario del error de contraseña
    para que el paciente del SIAU sepa cuál dato corregir. El bloqueo por
    intentos mitiga la fuerza bruta que esa decisión deja más visible.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        identificador = (
            request.data.get('identificador')
            or request.data.get('email')
            or request.data.get('cedula')
            or ''
        )
        password = request.data.get('password', '')
        if not str(identificador).strip() or not password:
            raise ValidationError({'detail': 'Ingrese su correo o cédula, y la contraseña.'})

        usuario = buscar_usuario_por_identificador(identificador)
        if usuario is None:
            registrar(request, 'login_usuario_inexistente', detalle=str(identificador).strip())
            return Response(
                {'detail': 'Error Usuario', 'campo': 'identificador'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not usuario.is_active:
            return Response(
                {'detail': 'La cuenta está inactiva.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if usuario.esta_bloqueado:
            return Response(
                {'detail': 'La cuenta está bloqueada por intentos fallidos. Espere unos minutos e intente de nuevo.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not usuario.check_password(password):
            usuario.failed_login_attempts += 1
            if usuario.failed_login_attempts >= settings.LOGIN_MAX_ATTEMPTS:
                usuario.locked_until = timezone.now() + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
                usuario.failed_login_attempts = 0
            usuario.save(update_fields=['failed_login_attempts', 'locked_until'])
            registrar(request, 'login_clave_invalida', usuario=usuario)
            return Response(
                {'detail': 'Error contraseña', 'campo': 'password'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # authenticate() también rechaza usuarios inactivos. La clave ya se comprobó.
        if authenticate(request, username=usuario.email, password=password) is None:
            return Response(
                {'detail': 'No fue posible iniciar sesión.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        usuario.failed_login_attempts = 0
        usuario.locked_until = None
        usuario.save(update_fields=['failed_login_attempts', 'locked_until'])

        if usuario.estado != Usuario.EstadoCuenta.ACTIVO or not usuario.email_verificado:
            registrar(request, 'login_cuenta_no_activa', usuario=usuario, detalle=usuario.estado)
            return Response(
                {'detail': _mensaje_estado(usuario), 'estado': usuario.estado},
                status=status.HTTP_403_FORBIDDEN,
            )

        if usuario.otp_enabled:
            registrar(request, 'login_pendiente_2fa', usuario=usuario)
            return Response(
                {
                    'requires_2fa': True,
                    'pre_auth': str(token_preautenticacion(usuario)),
                }
            )
        return _respuesta_sesion(usuario, request)


class Verificar2FAView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        bruto = request.data.get('pre_auth', '')
        codigo = str(request.data.get('codigo', '')).strip().replace(' ', '')
        try:
            token = AccessToken(bruto)
        except TokenError as exc:
            raise AuthenticationFailed('La verificación expiró. Inicie sesión de nuevo.') from exc
        if not token.get('pre_auth'):
            raise AuthenticationFailed('El token no corresponde a una verificación en dos pasos.')

        usuario = Usuario.objects.get(pk=token['user_id'])
        if not usuario.otp_enabled or not usuario.otp_secret:
            raise AuthenticationFailed('La cuenta no tiene el segundo factor activo.')
        if not pyotp.TOTP(usuario.otp_secret).verify(codigo, valid_window=1):
            registrar(request, '2fa_invalido', usuario=usuario)
            return Response(
                {'detail': 'El código de verificación no es válido.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return _respuesta_sesion(usuario, request)


class RefrescoView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        bruto = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not bruto:
            return Response({'detail': 'No hay sesión para renovar.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            anterior = RefreshToken(bruto)
            usuario = Usuario.objects.get(
                pk=anterior['user_id'],
                is_active=True,
                estado=Usuario.EstadoCuenta.ACTIVO,
                email_verificado=True,
            )
            anterior.blacklist()
        except (TokenError, Usuario.DoesNotExist):
            respuesta = Response({'detail': 'La sesión expiró.'}, status=status.HTTP_401_UNAUTHORIZED)
            return _borrar_cookie(respuesta)
        return _respuesta_sesion(usuario, request)


class SalirView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        bruto = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if bruto:
            try:
                RefreshToken(bruto).blacklist()
            except TokenError:
                pass
        if request.user.is_authenticated:
            registrar(request, 'logout', usuario=request.user)
        return _borrar_cookie(Response({'detail': 'Sesión cerrada.'}))


class YoView(APIView):
    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)


class Activar2FAView(APIView):
    """Genera el secreto TOTP y el código QR. Todavía no deja el factor activo."""

    def post(self, request):
        usuario = request.user
        if usuario.otp_enabled:
            return Response({'detail': 'La verificación en dos pasos ya está activa.'})
        secreto = pyotp.random_base32()
        usuario.otp_secret = secreto
        usuario.save(update_fields=['otp_secret'])
        uri = pyotp.TOTP(secreto).provisioning_uri(name=usuario.email, issuer_name='Tu Salud CM')
        imagen = qrcode.make(uri)
        buffer = io.BytesIO()
        imagen.save(buffer, format='PNG')
        codigo = base64.b64encode(buffer.getvalue()).decode('ascii')
        return Response({'otpauth_uri': uri, 'qr_base64': codigo})


class Confirmar2FAView(APIView):
    def post(self, request):
        usuario = request.user
        codigo = str(request.data.get('codigo', '')).strip().replace(' ', '')
        if not usuario.otp_secret:
            raise ValidationError({'detail': 'Primero genere el código QR.'})
        if not pyotp.TOTP(usuario.otp_secret).verify(codigo, valid_window=1):
            raise ValidationError({'detail': 'El código no coincide. Revise la hora del dispositivo.'})
        usuario.otp_enabled = True
        usuario.save(update_fields=['otp_enabled'])
        registrar(request, '2fa_activado', usuario=usuario)
        return Response({'otp_enabled': True})


class RecuperarClaveView(APIView):
    """
    HU-002. En este prototipo local no hay servidor de correo: si DEBUG está
    activo, la respuesta incluye el enlace temporal. En producción ese valor
    debe enviarse por correo y no devolverse en el JSON.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        identificador = (
            request.data.get('identificador')
            or request.data.get('email')
            or request.data.get('cedula')
            or ''
        )
        respuesta = {
            'detail': 'Si el correo o la cédula está registrado, se generó un enlace temporal de restablecimiento.',
        }
        usuario = buscar_usuario_por_identificador(identificador)
        if usuario and usuario.is_active:
            token = FIRMA_RECUPERACION.sign(str(usuario.pk))
            registrar(request, 'recuperacion_solicitada', usuario=usuario)
            if settings.DEBUG:
                respuesta['token_debug'] = token
        return Response(respuesta)


class RestablecerClaveView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token', '')
        password = request.data.get('password', '')
        try:
            usuario_id = FIRMA_RECUPERACION.unsign(token, max_age=60 * 30)
            usuario = Usuario.objects.get(pk=usuario_id, is_active=True)
        except (BadSignature, SignatureExpired, Usuario.DoesNotExist):
            raise ValidationError({'detail': 'El enlace de restablecimiento no es válido o ya expiró.'})
        try:
            validate_password(password, usuario)
        except Exception as exc:
            raise ValidationError({'password': list(getattr(exc, 'messages', [str(exc)]))})
        usuario.set_password(password)
        usuario.failed_login_attempts = 0
        usuario.locked_until = None
        usuario.save(update_fields=['password', 'failed_login_attempts', 'locked_until'])
        registrar(request, 'clave_restablecida', usuario=usuario)
        return Response({'detail': 'La contraseña fue actualizada. Ya puede iniciar sesión.'})


class MenoresView(APIView):
    """Lista solo menores ya aprobados. El alta queda como solicitud de tutela."""

    permission_classes = [IsPaciente]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        tutor = request.user.perfil_paciente
        menores = tutor.menores.all().order_by('nombres')
        return Response(MenorSerializer(menores, many=True).data)

    def post(self, request):
        tutor = request.user.perfil_paciente
        serializador = SolicitudTutelaSerializer(data=request.data, context={'tutor': tutor})
        serializador.is_valid(raise_exception=True)
        solicitud = serializador.save()
        registrar(request, 'tutela_solicitada', usuario=request.user, recurso=str(solicitud.pk))
        return Response(SolicitudTutelaSerializer(solicitud).data, status=status.HTTP_201_CREATED)


class SolicitudesTutelaPacienteView(APIView):
    permission_classes = [IsPaciente]

    def get(self, request):
        tutor = request.user.perfil_paciente
        solicitudes = tutor.solicitudes_tutela.all()
        return Response(SolicitudTutelaSerializer(solicitudes, many=True).data)


class SolicitudesTutelaAdminView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        solicitudes = SolicitudTutela.objects.select_related('tutor').order_by('-creado')
        if request.query_params.get('vista') != 'historial':
            solicitudes = solicitudes.filter(estado=SolicitudTutela.Estado.PENDIENTE)
        return Response(SolicitudTutelaSerializer(solicitudes, many=True).data)


def _solicitud_tutela_pendiente(solicitud_id):
    try:
        solicitud = SolicitudTutela.objects.select_related('tutor').get(pk=solicitud_id)
    except SolicitudTutela.DoesNotExist as exc:
        raise ValidationError({'detail': 'La solicitud de tutela no existe.'}) from exc
    if solicitud.estado != SolicitudTutela.Estado.PENDIENTE:
        raise ValidationError({'detail': 'Esta tutela ya no está pendiente de aprobación.'})
    return solicitud


class AprobarTutelaView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, solicitud_id):
        solicitud = _solicitud_tutela_pendiente(solicitud_id)
        if Paciente.objects.filter(numero_documento=solicitud.numero_documento).exists():
            raise ValidationError({'detail': 'Ese documento ya está registrado.'})
        menor = Paciente.objects.create(
            tutor=solicitud.tutor,
            usuario=None,
            nombres=solicitud.nombres,
            apellidos=solicitud.apellidos,
            tipo_documento=solicitud.tipo_documento,
            numero_documento=solicitud.numero_documento,
            fecha_nacimiento=solicitud.fecha_nacimiento,
        )
        solicitud.menor = menor
        solicitud.estado = SolicitudTutela.Estado.APROBADA
        solicitud.aprobado_por = request.user
        solicitud.fecha_decision = timezone.now()
        solicitud.motivo_rechazo = ''
        solicitud.save(update_fields=[
            'menor',
            'estado',
            'aprobado_por',
            'fecha_decision',
            'motivo_rechazo',
        ])
        registrar(
            request,
            'tutela_aprobada',
            usuario=request.user,
            recurso=str(solicitud.pk),
            detalle=solicitud.numero_documento,
        )
        return Response({
            'detail': 'La tutela fue aprobada. El menor ya puede usarse en citas y resultados.',
            'estado': solicitud.estado,
        })


class RechazarTutelaView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, solicitud_id):
        solicitud = _solicitud_tutela_pendiente(solicitud_id)
        solicitud.estado = SolicitudTutela.Estado.RECHAZADA
        solicitud.aprobado_por = request.user
        solicitud.fecha_decision = timezone.now()
        solicitud.motivo_rechazo = str(request.data.get('motivo', '')).strip()[:500]
        solicitud.save(update_fields=[
            'estado',
            'aprobado_por',
            'fecha_decision',
            'motivo_rechazo',
        ])
        registrar(
            request,
            'tutela_rechazada',
            usuario=request.user,
            recurso=str(solicitud.pk),
            detalle=solicitud.motivo_rechazo or solicitud.numero_documento,
        )
        return Response({'detail': 'La solicitud de tutela fue rechazada.', 'estado': solicitud.estado})


class SoporteTutelaView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, solicitud_id):
        try:
            solicitud = SolicitudTutela.objects.get(pk=solicitud_id)
        except SolicitudTutela.DoesNotExist as exc:
            raise NotFound('No se encontró la solicitud de tutela.') from exc
        if not solicitud.soporte:
            raise NotFound('El documento adjunto no está disponible.')
        try:
            archivo = solicitud.soporte.open('rb')
        except FileNotFoundError as exc:
            raise NotFound('El documento adjunto no está disponible.') from exc
        tipo = content_type_soporte(solicitud.tipo_soporte, solicitud.soporte.name)
        respuesta = FileResponse(archivo, content_type=tipo)
        respuesta['Content-Disposition'] = f'inline; filename="documento-tutela-{solicitud.pk}"'
        return respuesta


class MedicosAdminView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        medicos = Medico.objects.select_related('usuario').order_by('usuario__first_name')
        return Response(MedicoSerializer(medicos, many=True).data)

    def post(self, request):
        serializador = MedicoAltaSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        usuario = serializador.save()
        registrar(request, 'medico_creado', usuario=request.user, recurso=usuario.email)
        return Response(MedicoSerializer(usuario.perfil_medico).data, status=status.HTTP_201_CREATED)


class VerificarEmailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        usuario, error = buscar_por_token(token)
        if usuario is None:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        usuario.email_verificado = True
        usuario.estado = Usuario.EstadoCuenta.PENDIENTE_APROBACION
        usuario.token_verificacion = None
        usuario.token_expira = None
        usuario.save(update_fields=[
            'email_verificado',
            'estado',
            'token_verificacion',
            'token_expira',
        ])
        enviar_aviso_admin(usuario)
        registrar(request, 'correo_verificado', usuario=usuario)
        return Response({
            'detail': 'Correo confirmado. Tu cuenta está en revisión por un administrador.',
            'estado': usuario.estado,
        })


def _datos_solicitud(usuario):
    perfil = getattr(usuario, 'perfil_paciente', None)
    if usuario.estado in (
        Usuario.EstadoCuenta.PENDIENTE_VERIFICACION,
        Usuario.EstadoCuenta.PENDIENTE_APROBACION,
    ):
        clasificacion = 'pendiente'
    elif usuario.estado == Usuario.EstadoCuenta.ACTIVO:
        clasificacion = 'activo'
    elif usuario.estado == Usuario.EstadoCuenta.RECHAZADO:
        clasificacion = 'rechazado'
    else:
        clasificacion = usuario.estado
    return {
        'id': usuario.id,
        'nombres': usuario.first_name,
        'apellidos': usuario.last_name,
        'email': usuario.email,
        'telefono': usuario.telefono,
        'estado': usuario.estado,
        'clasificacion': clasificacion,
        'numero_documento': perfil.numero_documento if perfil else None,
        'motivo_rechazo': usuario.motivo_rechazo,
        'fecha_aprobacion': usuario.fecha_aprobacion,
        'creado': usuario.date_joined,
    }


def _exigir_pendiente(usuario):
    if usuario.estado != Usuario.EstadoCuenta.PENDIENTE_APROBACION or not usuario.email_verificado:
        raise ValidationError({'detail': 'Esta solicitud ya no está pendiente de aprobación.'})


class SolicitudesView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        cuentas = (
            Usuario.objects.filter(rol=Usuario.Rol.PACIENTE)
            .select_related('perfil_paciente')
            .order_by('-date_joined')
        )
        if request.query_params.get('vista') != 'historial':
            cuentas = cuentas.filter(estado=Usuario.EstadoCuenta.PENDIENTE_APROBACION)
        return Response([_datos_solicitud(usuario) for usuario in cuentas])


class AprobarSolicitudView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
        except Usuario.DoesNotExist:
            raise ValidationError({'detail': 'La solicitud no existe.'})
        _exigir_pendiente(usuario)
        usuario.estado = Usuario.EstadoCuenta.ACTIVO
        usuario.aprobado_por = request.user
        usuario.fecha_aprobacion = timezone.now()
        usuario.motivo_rechazo = ''
        usuario.save(update_fields=[
            'estado',
            'aprobado_por',
            'fecha_aprobacion',
            'motivo_rechazo',
        ])
        enviar_aprobacion(usuario)
        registrar(
            request,
            'cuenta_aprobada',
            usuario=request.user,
            recurso=str(usuario.pk),
            detalle=usuario.email,
        )
        return Response({'detail': 'La cuenta fue aprobada.', 'estado': usuario.estado})


class RechazarSolicitudView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, usuario_id):
        try:
            usuario = Usuario.objects.get(pk=usuario_id)
        except Usuario.DoesNotExist:
            raise ValidationError({'detail': 'La solicitud no existe.'})
        _exigir_pendiente(usuario)
        usuario.estado = Usuario.EstadoCuenta.RECHAZADO
        usuario.aprobado_por = request.user
        usuario.fecha_aprobacion = timezone.now()
        usuario.motivo_rechazo = str(request.data.get('motivo', '')).strip()[:500]
        usuario.save(update_fields=[
            'estado',
            'aprobado_por',
            'fecha_aprobacion',
            'motivo_rechazo',
        ])
        enviar_rechazo(usuario)
        registrar(
            request,
            'cuenta_rechazada',
            usuario=request.user,
            recurso=str(usuario.pk),
            detalle=usuario.motivo_rechazo or usuario.email,
        )
        return Response({'detail': 'La solicitud fue rechazada.', 'estado': usuario.estado})


class DecisionFirmadaView(APIView):
    """El enlace del correo trae un token firmado y además exige sesión de administración."""

    permission_classes = [IsAdmin]

    def post(self, request):
        token = request.data.get('token', '')
        try:
            valor = FIRMA_DECISION.unsign(token, max_age=settings.VERIFICATION_TOKEN_HOURS * 3600)
            usuario_id, accion = valor.split(':', 1)
            usuario = Usuario.objects.get(pk=int(usuario_id))
        except (BadSignature, SignatureExpired, ValueError, Usuario.DoesNotExist):
            raise ValidationError({'detail': 'El enlace de decisión no es válido o expiró.'})
        if accion == 'aprobar':
            return AprobarSolicitudView().post(request, usuario.id)
        if accion == 'rechazar':
            return RechazarSolicitudView().post(request, usuario.id)
        raise ValidationError({'detail': 'La acción no es válida.'})
