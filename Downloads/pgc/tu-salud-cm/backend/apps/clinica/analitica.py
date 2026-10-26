from collections import defaultdict
from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.agenda.models import Cita
from apps.login.permissions import IsAdmin


class ResumenAnaliticaView(APIView):
    """
    Asignación y asistencia entre dos fechas.
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        hoy = timezone.localdate()
        desde = parse_date(str(request.query_params.get('desde', '')).strip()) or (hoy - timedelta(days=13))
        hasta = parse_date(str(request.query_params.get('hasta', '')).strip()) or hoy
        if hasta < desde:
            raise ValidationError({'detail': 'La fecha final es anterior a la inicial.'})
        if (hasta - desde).days > 180:
            raise ValidationError({'detail': 'Consulte un rango de máximo 180 días.'})

        zona = timezone.get_current_timezone()
        inicio = timezone.make_aware(datetime.combine(desde, datetime.min.time()), zona)
        fin = timezone.make_aware(datetime.combine(hasta, datetime.max.time().replace(microsecond=0)), zona)
        estados = [
            Cita.Estado.CONFIRMADO,
            Cita.Estado.ATENDIDO,
            Cita.Estado.NO_ASISTIO,
        ]
        ahora = timezone.now()
        filas = Cita.objects.filter(
            inicio__gte=inicio,
            inicio__lte=fin,
            estado__in=estados,
        ).order_by('inicio').values_list('inicio', 'fin', 'estado')

        serie = defaultdict(lambda: {
            'confirmado': 0,
            'atendido': 0,
            'no_asistio': 0,
            'inconsistencia': 0,
        })
        for inicio_cita, fin_cita, estado in filas:
            if estado == Cita.Estado.CONFIRMADO and fin_cita + timedelta(minutes=30) < ahora:
                # El médico no registró asistencia dentro del plazo.
                clave = 'inconsistencia'
            else:
                clave = estado
            marca = timezone.localtime(inicio_cita)
            serie[marca.strftime('%d/%m')][clave] += 1

        datos = [
            {'etiqueta': etiqueta, **valores}
            for etiqueta, valores in serie.items()
        ]
        totales = {
            'confirmado': sum(item['confirmado'] for item in datos),
            'atendido': sum(item['atendido'] for item in datos),
            'no_asistio': sum(item['no_asistio'] for item in datos),
            'inconsistencia': sum(item['inconsistencia'] for item in datos),
        }
        ofertados = Cita.objects.filter(inicio__gte=inicio, inicio__lte=fin).count()
        return Response({
            'desde': desde,
            'hasta': hasta,
            'serie': datos,
            'totales': totales,
            'cupos_en_ventana': ofertados,
        })
