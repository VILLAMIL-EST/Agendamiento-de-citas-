"""Tokens de verificación de correo y límite de registros por dirección IP."""

import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import Usuario

logger = logging.getLogger(__name__)


def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def asignar_token(usuario):
    """Genera un token de un solo uso y guarda solo su hash."""
    token = secrets.token_urlsafe(32)
    usuario.token_verificacion = hash_token(token)
    usuario.token_expira = timezone.now() + timedelta(hours=settings.VERIFICATION_TOKEN_HOURS)
    usuario.save(update_fields=['token_verificacion', 'token_expira'])
    return token


def buscar_por_token(token):
    if not token:
        return None, 'El enlace de verificación no es válido.'
    try:
        usuario = Usuario.objects.get(token_verificacion=hash_token(token))
    except Usuario.DoesNotExist:
        return None, 'El enlace no es válido o ya fue usado.'
    if usuario.email_verificado or usuario.estado != Usuario.EstadoCuenta.PENDIENTE_VERIFICACION:
        return None, 'Esta cuenta ya confirmó el correo.'
    if not usuario.token_expira or usuario.token_expira < timezone.now():
        usuario.token_verificacion = None
        usuario.token_expira = None
        usuario.save(update_fields=['token_verificacion', 'token_expira'])
        return None, 'El enlace expiró. Vuelva a registrarse para recibir otro correo.'
    return usuario, ''


def cupo_de_registro(ip):
    """Como máximo REGISTRO_LIMITE altas por IP durante una hora."""
    clave = f'registro:{ip or "sin-ip"}'
    try:
        actual = cache.get(clave, 0)
        if actual >= settings.REGISTRO_LIMITE:
            return False
        cache.set(clave, actual + 1, timeout=settings.REGISTRO_VENTANA_SEGUNDOS)
    except Exception:
        logger.warning('No se pudo aplicar el límite de registro. Se permite la solicitud.')
    return True
