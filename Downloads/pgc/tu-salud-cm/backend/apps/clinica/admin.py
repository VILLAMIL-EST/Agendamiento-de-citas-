from django.contrib import admin

from .models import ResultadoClinico


@admin.register(ResultadoClinico)
class ResultadoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'paciente', 'medico', 'fecha_resultado', 'cifrado')
    search_fields = ('titulo', 'paciente__numero_documento')
