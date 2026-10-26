import ssl

from django.core.mail.backends.smtp import EmailBackend
from django.utils.functional import cached_property


class BrevoEmailBackend(EmailBackend):
    """
    El relay regional de Brevo presenta un certificado que no coincide
    con smtp-relay.brevo.com. Se valida la cadena, no el nombre.
    """

    @cached_property
    def ssl_context(self):
        contexto = ssl.create_default_context()
        contexto.check_hostname = False
        return contexto
