from datetime import timedelta

from django.conf import settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken


class TokenRefresco(RefreshToken):
    """Refresh token con el rol embebido. El access token hereda esos claims."""

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        token['email'] = user.email
        token['rol'] = user.rol
        token['is_patient'] = user.is_patient
        token['is_doctor'] = user.is_doctor
        token['is_admin'] = user.is_admin
        return token


def token_preautenticacion(user):
    """Token de vida corta. No abre sesión: solo habilita el paso TOTP."""
    token = AccessToken.for_user(user)
    token['pre_auth'] = True
    token['email'] = user.email
    token.set_exp(lifetime=timedelta(minutes=settings.PREAUTH_MINUTES))
    return token
