from django.contrib import admin

from .models import Cita, EventoCita, Horario


@admin.register(Horario)
class HorarioAdmin(admin.ModelAdmin):
    list_display = ('medico', 'fecha', 'dia_semana', 'hora_inicio', 'hora_fin', 'publicada', 'activo')
    list_filter = ('publicada', 'activo')


@admin.register(Cita)
class CitaAdmin(admin.ModelAdmin):
    list_display = ('inicio', 'medico', 'paciente', 'estado', 'lease_expires_at')
    list_filter = ('estado', 'canal')
    search_fields = ('paciente__numero_documento', 'paciente__apellidos')


@admin.register(EventoCita)
class EventoCitaAdmin(admin.ModelAdmin):
    list_display = ('creado', 'tipo', 'cita', 'actor')
    readonly_fields = ('cita', 'tipo', 'actor', 'paciente', 'detalle', 'creado')
