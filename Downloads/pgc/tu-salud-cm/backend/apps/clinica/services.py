"""Cifrado de resultados clínicos antes de persistirlos."""

import io

from django.conf import settings
from django.core.files.base import ContentFile
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from rest_framework.exceptions import ValidationError

from .models import ResultadoClinico


def cifrar_pdf(archivo, documento_paciente):
    """
    Cifra el PDF con AES-256.

    La contraseña de apertura es el documento del paciente (cédula, tarjeta
    de identidad o registro civil). La contraseña de propietario queda en el
    servidor y no se entrega al navegador: permite a la institución conservar
    el control del archivo sin desactivar la clave del paciente.
    """
    documento = str(documento_paciente or '').strip()
    if len(documento) < 5:
        raise ValidationError({'detail': 'El paciente no tiene un documento válido para cifrar el PDF.'})
    if documento == settings.PDF_OWNER_PASSWORD:
        raise ValidationError({'detail': 'No se puede cifrar el PDF con esa clave.'})

    contenido = archivo.read()
    if len(contenido) > settings.PDF_MAX_BYTES:
        raise ValidationError({'detail': 'El PDF supera el tamaño máximo de 5 MB.'})
    if not contenido.startswith(b'%PDF'):
        raise ValidationError({'detail': 'El archivo no es un PDF válido.'})

    try:
        lector = PdfReader(io.BytesIO(contenido))
    except PdfReadError as exc:
        raise ValidationError({'detail': 'No se pudo leer el PDF.'}) from exc
    if lector.is_encrypted:
        raise ValidationError({'detail': 'Suba el PDF original, sin contraseña.'})

    escritor = PdfWriter()
    for pagina in lector.pages:
        escritor.add_page(pagina)
    if not escritor.pages:
        raise ValidationError({'detail': 'El PDF no contiene páginas.'})

    escritor.encrypt(
        user_password=documento,
        owner_password=settings.PDF_OWNER_PASSWORD,
        algorithm='AES-256',
    )
    salida = io.BytesIO()
    escritor.write(salida)
    return salida.getvalue()


def guardar_resultado(*, paciente, medico, titulo, tipo, fecha_resultado, archivo, cita=None):
    cifrado = cifrar_pdf(archivo, paciente.numero_documento)
    resultado = ResultadoClinico(
        paciente=paciente,
        medico=medico,
        cita=cita,
        titulo=titulo.strip(),
        tipo=tipo,
        fecha_resultado=fecha_resultado,
        cifrado=True,
    )
    resultado.archivo.save('reporte.pdf', ContentFile(cifrado), save=False)
    resultado.save()
    return resultado
