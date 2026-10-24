from .models import AuditoriaAcceso


def ip_de(request):
    reenviada = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if reenviada:
        return reenviada.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def registrar(request, accion, usuario=None, recurso='', detalle=''):
    AuditoriaAcceso.objects.create(
        usuario=usuario if getattr(usuario, 'pk', None) else None,
        accion=accion,
        recurso=recurso[:160],
        detalle=detalle[:240],
        ip=ip_de(request),
    )
