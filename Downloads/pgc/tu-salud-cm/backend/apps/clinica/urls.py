from django.urls import path

from .views import (
    DescargarResultadoView,
    PacientesDelMedicoView,
    ResultadosCitaMedicoView,
    ResultadosView,
    SubirResultadoView,
)

urlpatterns = [
    path('', ResultadosView.as_view(), name='resultados'),
    path('subir/', SubirResultadoView.as_view(), name='subir-resultado'),
    path('cita/<int:cita_id>/', ResultadosCitaMedicoView.as_view(), name='resultados-cita'),
    path('<int:resultado_id>/descargar/', DescargarResultadoView.as_view(), name='descargar-resultado'),
    path('pacientes-medico/', PacientesDelMedicoView.as_view(), name='pacientes-medico'),
]
