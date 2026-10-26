"""Validación del documento adjunto en una solicitud de tutela."""

from django.conf import settings
from rest_framework.exceptions import ValidationError


def validar_soporte(archivo):
    """
    Acepta foto (JPG, PNG, WEBP) o PDF del documento del menor.
    Devuelve 'pdf' o 'imagen'.
    """
    if archivo is None:
        raise ValidationError('Adjunte una foto o un PDF del documento del menor.')

    contenido = archivo.read()
    archivo.seek(0)
    if not contenido:
        raise ValidationError('El archivo adjunto está vacío.')
    if len(contenido) > settings.PDF_MAX_BYTES:
        raise ValidationError('El archivo supera el tamaño máximo de 5 MB.')

    if contenido.startswith(b'%PDF'):
        return 'pdf'
    if contenido.startswith(b'\xff\xd8\xff') or contenido.startswith(b'\x89PNG'):
        return 'imagen'
    if contenido.startswith(b'RIFF') and len(contenido) >= 12 and contenido[8:12] == b'WEBP':
        return 'imagen'
    raise ValidationError('Adjunte una foto (JPG, PNG o WEBP) o un PDF del documento.')


def content_type_soporte(tipo, nombre=''):
    if tipo == 'pdf' or str(nombre).lower().endswith('.pdf'):
        return 'application/pdf'
    if str(nombre).lower().endswith('.png'):
        return 'image/png'
    if str(nombre).lower().endswith('.webp'):
        return 'image/webp'
    return 'image/jpeg'
