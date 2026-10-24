from django.urls import path

from .analitica import ResumenAnaliticaView

urlpatterns = [
    path('resumen/', ResumenAnaliticaView.as_view(), name='analitica-resumen'),
]
