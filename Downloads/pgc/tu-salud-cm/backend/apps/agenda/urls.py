from django.urls import path

from .views import (
    AsistenciaView,
    BloquearCupoView,
    CalendarioMedicoView,
    CancelarCitaView,
    ConfirmarCupoView,
    DisponibilidadView,
    GenerarCuposView,
    HorarioDetalleView,
    HorariosView,
    LiberarCupoView,
    MedicosDisponiblesView,
    MisCitasView,
)

urlpatterns = [
    path('medicos/', MedicosDisponiblesView.as_view(), name='medicos'),
    path('disponibilidad/', DisponibilidadView.as_view(), name='disponibilidad'),
    path('citas/bloquear/', BloquearCupoView.as_view(), name='bloquear'),
    path('citas/<int:cita_id>/liberar/', LiberarCupoView.as_view(), name='liberar'),
    path('citas/<int:cita_id>/confirmar/', ConfirmarCupoView.as_view(), name='confirmar'),
    path('citas/<int:cita_id>/cancelar/', CancelarCitaView.as_view(), name='cancelar'),
    path('citas/mias/', MisCitasView.as_view(), name='mis-citas'),
    path('medico/calendario/', CalendarioMedicoView.as_view(), name='calendario'),
    path('citas/<int:cita_id>/asistencia/', AsistenciaView.as_view(), name='asistencia'),
    path('horarios/', HorariosView.as_view(), name='horarios'),
    path('horarios/<int:horario_id>/', HorarioDetalleView.as_view(), name='horario-detalle'),
    path('cupos/generar/', GenerarCuposView.as_view(), name='generar-cupos'),
]
