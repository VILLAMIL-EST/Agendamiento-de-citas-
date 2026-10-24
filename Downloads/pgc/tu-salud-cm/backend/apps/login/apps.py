from django.apps import AppConfig


class LoginConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.login'
    # El label conserva las tablas y AUTH_USER_MODEL ya creados en PostgreSQL.
    label = 'cuentas'
    verbose_name = 'Acceso y cuentas'
