"""Correos del alta de pacientes. Usa el backend configurado en settings."""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.core.signing import TimestampSigner

from .models import Usuario

logger = logging.getLogger(__name__)
FIRMA_DECISION = TimestampSigner(salt='tusalud-decision-cuenta')


def _enviar(asunto, cuerpo, destinatarios):
    destinos = [correo for correo in destinatarios if correo]
    if not destinos:
        logger.warning('No hay destinatario para el correo: %s', asunto)
        return False
    send_mail(
        asunto,
        cuerpo,
        settings.DEFAULT_FROM_EMAIL,
        destinos,
        fail_silently=False,
    )
    return True


def correos_administradores():
    propios = Usuario.objects.filter(
        rol=Usuario.Rol.ADMIN,
        estado=Usuario.EstadoCuenta.ACTIVO,
        is_active=True,
    ).values_list('email', flat=True)
    return list(dict.fromkeys([*propios, settings.ADMIN_NOTIFICATION_EMAIL]))


def enlace_verificacion(token):
    return f'{settings.FRONTEND_URL}/verificar-email/{token}'


def enviar_verificacion(usuario, token):
    enlace = enlace_verificacion(token)
    cuerpo = (
        f'Hola {usuario.first_name},\n\n'
        'Confirme su correo para continuar el registro en Tu Salud CM. '
        f'El enlace vence en {settings.VERIFICATION_TOKEN_HOURS} horas y solo puede usarse una vez.\n\n'
        f'{enlace}\n\n'
        'Si usted no creó esta cuenta, ignore este mensaje.\n'
    )
    _enviar('Confirme su correo en Tu Salud CM', cuerpo, [usuario.email])
    return enlace


def token_decision(usuario, accion):
    return FIRMA_DECISION.sign(f'{usuario.pk}:{accion}')


def enviar_aviso_admin(usuario):
    aprobar = f'{settings.FRONTEND_URL}/solicitudes/decidir?token={token_decision(usuario, "aprobar")}'
    rechazar = f'{settings.FRONTEND_URL}/solicitudes/decidir?token={token_decision(usuario, "rechazar")}'
    cuerpo = (
        f'{usuario.get_full_name()} ({usuario.email}) confirmó su correo y espera aprobación.\n\n'
        f'Revise la bandeja: {settings.FRONTEND_URL}/solicitudes\n\n'
        'Estos enlaces solo funcionan con una sesión de administración iniciada:\n'
        f'Aprobar: {aprobar}\n'
        f'Rechazar: {rechazar}\n'
    )
    _enviar('Nueva solicitud de cuenta en Tu Salud CM', cuerpo, correos_administradores())


def enviar_aprobacion(usuario):
    cuerpo = (
        f'Hola {usuario.first_name},\n\n'
        'Su cuenta en Tu Salud CM fue aprobada. Ya puede iniciar sesión con su correo y contraseña.\n\n'
        f'{settings.FRONTEND_URL}/login\n'
    )
    _enviar('Su cuenta fue aprobada', cuerpo, [usuario.email])


def enviar_rechazo(usuario):
    motivo = usuario.motivo_rechazo.strip() or 'No se indicó un motivo.'
    cuerpo = (
        f'Hola {usuario.first_name},\n\n'
        'Su solicitud de cuenta en Tu Salud CM fue rechazada.\n\n'
        f'Motivo: {motivo}\n'
    )
    _enviar('Su solicitud de cuenta fue rechazada', cuerpo, [usuario.email])
