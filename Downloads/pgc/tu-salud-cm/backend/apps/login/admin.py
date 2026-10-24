from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AuditoriaAcceso, Medico, Paciente, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'rol', 'estado', 'email_verificado', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    fieldsets = UserAdmin.fieldsets + (
        ('Tu Salud CM', {
            'fields': (
                'rol',
                'estado',
                'email_verificado',
                'telefono',
                'consentimiento_datos',
                'otp_enabled',
                'aprobado_por',
                'fecha_aprobacion',
                'motivo_rechazo',
            ),
        }),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'rol', 'password1', 'password2'),
        }),
    )


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = ('nombre_completo', 'tipo_documento', 'numero_documento', 'tutor')
    search_fields = ('nombres', 'apellidos', 'numero_documento')


@admin.register(Medico)
class MedicoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'registro_medico', 'especialidad', 'activo')
    search_fields = ('usuario__email', 'registro_medico', 'numero_documento')


@admin.register(AuditoriaAcceso)
class AuditoriaAdmin(admin.ModelAdmin):
    list_display = ('creado', 'accion', 'usuario', 'ip')
    list_filter = ('accion',)
    readonly_fields = ('usuario', 'accion', 'recurso', 'ip', 'detalle', 'creado')
