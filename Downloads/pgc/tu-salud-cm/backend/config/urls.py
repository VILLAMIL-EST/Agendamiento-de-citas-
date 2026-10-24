from django.contrib import admin
from django.urls import include, path

from apps.login.views import (
    AprobarSolicitudView,
    RechazarSolicitudView,
    RegistroView,
    SolicitudesView,
    VerificarEmailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.login.urls')),
    path('api/registro/', RegistroView.as_view()),
    path('api/verificar-email/<str:token>/', VerificarEmailView.as_view()),
    path('api/admin/solicitudes/', SolicitudesView.as_view()),
    path('api/admin/solicitudes/<int:usuario_id>/aprobar/', AprobarSolicitudView.as_view()),
    path('api/admin/solicitudes/<int:usuario_id>/rechazar/', RechazarSolicitudView.as_view()),
    path('api/agenda/', include('apps.agenda.urls')),
    path('api/resultados/', include('apps.clinica.urls')),
    path('api/analitica/', include('apps.clinica.analitica_urls')),
]
