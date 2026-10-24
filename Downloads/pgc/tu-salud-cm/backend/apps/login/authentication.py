from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class JWTAuthenticationSinPreAuth(JWTAuthentication):
    """
    Rechaza el token temporal de 2FA.

    Ese token solo sirve para canjear el código TOTP. Si se aceptara como
    sesión, un atacante que conociera la contraseña podría usar la API
    sin completar el segundo factor.
    """

    def get_user(self, validated_token):
        if validated_token.get('pre_auth'):
            raise InvalidToken('El token de verificación no autoriza el uso de la API.')
        return super().get_user(validated_token)
