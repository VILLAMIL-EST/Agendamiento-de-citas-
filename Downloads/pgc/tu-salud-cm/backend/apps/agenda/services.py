"""
Lease Pattern para el agendamiento ambulatorio.

Un cupo disponible se arrienda por LEASE_MINUTES. Mientras el arrendamiento
esté vigente, ninguna otra transacción puede confirmarlo: select_for_update
bloquea la fila y la restricción única (médico, inicio) impide un cupo duplicado.
Si el paciente no confirma a tiempo, el cupo vuelve a quedar disponible.
"""

import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.login.models import Paciente

from .models import Cita, EventoCita, Horario

logger = logging.getLogger(__name__)


def _cache_get(clave):
    try:
        return cache.get(clave)
    except Exception:
        logger.warning('Redis no respondió. La disponibilidad se lee desde PostgreSQL.')
        return None


def _cache_set(clave, valor, timeout):
    try:
        cache.set(clave, valor, timeout)
    except Exception:
        logger.warning('Redis no respondió. El cupo quedó guardado solo en PostgreSQL.')


def _cache_delete(clave):
    try:
        cache.delete(clave)
    except Exception:
        logger.warning('Redis no respondió al invalidar la caché de cupos.')


def dias_habiles(desde, hasta):
    """Días hábiles entre la solicitud y la asignación, sin contar festivos."""
    if not desde or not hasta:
        return None
    inicio = timezone.localtime(desde).date()
    fin = timezone.localtime(hasta).date()
    if fin <= inicio:
        return 0
    dias = 0
    actual = inicio
    while actual < fin:
        if actual.weekday() < 5:
            dias += 1
        actual += timedelta(days=1)
    return dias


def clave_cupos(medico_id, fecha):
    return f'agenda:cupos:{medico_id}:{fecha.isoformat()}'


def invalidar_cupos(medico_id, fecha):
    _cache_delete(clave_cupos(medico_id, fecha))


def liberar_leases_expirados():
    """Devuelve a disponible los cupos cuyo arrendamiento ya venció."""
    ahora = timezone.now()
    vencidos = list(
        Cita.objects.filter(
            estado=Cita.Estado.BLOQUEADO,
            lease_expires_at__lt=ahora,
        ).values_list('id', 'medico_id', 'inicio')
    )
    if not vencidos:
        return 0
    ids = [item[0] for item in vencidos]
    Cita.objects.filter(id__in=ids).update(
        estado=Cita.Estado.DISPONIBLE,
        lease_expires_at=None,
        leased_by=None,
        paciente=None,
        solicitante=None,
        motivo='',
    )
    for _cita_id, medico_id, inicio in vencidos:
        invalidar_cupos(medico_id, timezone.localtime(inicio).date())
    return len(ids)


def _exigir_cupo(cita):
    if cita is None:
        raise ValidationError({'detail': 'El cupo no existe.'})


@transaction.atomic
def bloquear_cupo(cita_id, usuario):
    """
    Arrienda un cupo al usuario autenticado.

    La transacción atómica y el bloqueo de fila evitan que dos pacientes
    confirmen el mismo horario. Si el mismo usuario renueva su propio
    arrendamiento vigente, el vencimiento se extiende.
    """
    liberar_leases_expirados()
    try:
        cita = Cita.objects.select_for_update().get(pk=cita_id)
    except Cita.DoesNotExist:
        raise ValidationError({'detail': 'El cupo no existe.'})

    ahora = timezone.now()
    if cita.inicio <= ahora:
        raise ValidationError({'detail': 'No se puede reservar un cupo que ya pasó.'})

    propio = (
        cita.estado == Cita.Estado.BLOQUEADO
        and cita.leased_by_id == usuario.id
        and cita.lease_expires_at
        and cita.lease_expires_at >= ahora
    )
    if cita.estado != Cita.Estado.DISPONIBLE and not propio:
        raise ValidationError({'detail': 'Ese horario ya no está disponible.'})

    cita.estado = Cita.Estado.BLOQUEADO
    cita.lease_expires_at = ahora + timedelta(minutes=settings.LEASE_MINUTES)
    cita.leased_by = usuario
    cita.save(update_fields=['estado', 'lease_expires_at', 'leased_by', 'actualizado'])
    EventoCita.objects.create(
        cita=cita,
        tipo=EventoCita.Tipo.BLOQUEO,
        actor=usuario,
        detalle=f'Arrendamiento hasta {cita.lease_expires_at:%H:%M}.',
    )
    invalidar_cupos(cita.medico_id, timezone.localtime(cita.inicio).date())
    return cita


@transaction.atomic
def liberar_cupo(cita_id, usuario):
    """El paciente suelta el cupo antes de que venza el arrendamiento."""
    try:
        cita = Cita.objects.select_for_update().get(pk=cita_id)
    except Cita.DoesNotExist:
        raise ValidationError({'detail': 'El cupo no existe.'})
    if cita.estado != Cita.Estado.BLOQUEADO or cita.leased_by_id != usuario.id:
        raise ValidationError({'detail': 'No tiene un arrendamiento activo sobre ese cupo.'})
    fecha = timezone.localtime(cita.inicio).date()
    medico_id = cita.medico_id
    cita.estado = Cita.Estado.DISPONIBLE
    cita.lease_expires_at = None
    cita.leased_by = None
    cita.save(update_fields=['estado', 'lease_expires_at', 'leased_by', 'actualizado'])
    EventoCita.objects.create(
        cita=cita,
        tipo=EventoCita.Tipo.LIBERACION,
        actor=usuario,
    )
    invalidar_cupos(medico_id, fecha)
    return cita


def paciente_del_usuario(usuario):
    perfil = getattr(usuario, 'perfil_paciente', None)
    if perfil is None:
        raise ValidationError({'detail': 'El usuario no tiene perfil de paciente.'})
    return perfil


def resolver_beneficiario(solicitante, paciente_id):
    """El tutor solo puede agendar para sí mismo o para un menor a su cargo."""
    if paciente_id in (None, '', solicitante.id, str(solicitante.id)):
        return solicitante
    try:
        menor = Paciente.objects.get(pk=paciente_id, tutor=solicitante)
    except Paciente.DoesNotExist:
        raise ValidationError({'detail': 'Ese paciente no está a su cargo.'})
    return menor


@transaction.atomic
def confirmar_cupo(cita_id, usuario, paciente_id, motivo=''):
    """
    Confirma el cupo solo si el arrendamiento sigue vigente y pertenece
    al usuario que lo bloqueó.
    """
    solicitante = paciente_del_usuario(usuario)
    beneficiario = resolver_beneficiario(solicitante, paciente_id)
    try:
        cita = Cita.objects.select_for_update().get(pk=cita_id)
    except Cita.DoesNotExist:
        raise ValidationError({'detail': 'El cupo no existe.'})

    ahora = timezone.now()
    if cita.estado != Cita.Estado.BLOQUEADO or cita.leased_by_id != usuario.id:
        raise ValidationError({'detail': 'Debe bloquear el cupo antes de confirmarlo.'})
    if not cita.lease_expires_at or cita.lease_expires_at < ahora:
        cita.estado = Cita.Estado.DISPONIBLE
        cita.lease_expires_at = None
        cita.leased_by = None
        cita.save(update_fields=['estado', 'lease_expires_at', 'leased_by', 'actualizado'])
        invalidar_cupos(cita.medico_id, timezone.localtime(cita.inicio).date())
        raise ValidationError({'detail': 'El tiempo para confirmar la cita se agotó. Elija el horario de nuevo.'})

    cita.estado = Cita.Estado.CONFIRMADO
    cita.paciente = beneficiario
    cita.solicitante = solicitante
    cita.motivo = (motivo or '')[:180]
    cita.fecha_solicitud = ahora
    cita.fecha_asignacion = cita.inicio
    cita.lease_expires_at = None
    cita.leased_by = None
    cita.save()
    EventoCita.objects.create(
        cita=cita,
        tipo=EventoCita.Tipo.CONFIRMACION,
        actor=usuario,
        paciente=beneficiario,
        detalle=motivo[:240],
    )
    invalidar_cupos(cita.medico_id, timezone.localtime(cita.inicio).date())
    return cita


@transaction.atomic
def cancelar_cita(cita_id, usuario):
    solicitante = paciente_del_usuario(usuario)
    try:
        cita = Cita.objects.select_for_update().get(pk=cita_id)
    except Cita.DoesNotExist:
        raise ValidationError({'detail': 'La cita no existe.'})
    if cita.estado != Cita.Estado.CONFIRMADO:
        raise ValidationError({'detail': 'Solo se puede cancelar una cita confirmada.'})
    if cita.inicio <= timezone.now():
        raise ValidationError({'detail': 'La cita ya comenzó y no se puede cancelar por este canal.'})
    if cita.solicitante_id != solicitante.id and cita.paciente_id != solicitante.id:
        raise ValidationError({'detail': 'No puede cancelar una cita que no solicitó.'})

    paciente = cita.paciente
    fecha = timezone.localtime(cita.inicio).date()
    medico_id = cita.medico_id
    EventoCita.objects.create(
        cita=cita,
        tipo=EventoCita.Tipo.CANCELACION,
        actor=usuario,
        paciente=paciente,
    )
    cita.estado = Cita.Estado.DISPONIBLE
    cita.paciente = None
    cita.solicitante = None
    cita.motivo = ''
    cita.fecha_solicitud = None
    cita.fecha_asignacion = None
    cita.lease_expires_at = None
    cita.leased_by = None
    cita.save()
    invalidar_cupos(medico_id, fecha)
    return cita


@transaction.atomic
def registrar_asistencia(cita_id, medico, estado):
    if estado not in (Cita.Estado.ATENDIDO, Cita.Estado.NO_ASISTIO):
        raise ValidationError({'detail': 'El estado de asistencia no es válido.'})
    try:
        cita = Cita.objects.select_for_update().get(pk=cita_id, medico=medico)
    except Cita.DoesNotExist:
        raise ValidationError({'detail': 'La cita no está asignada a este profesional.'})
    if cita.estado not in (Cita.Estado.CONFIRMADO, Cita.Estado.ATENDIDO, Cita.Estado.NO_ASISTIO):
        raise ValidationError({'detail': 'La cita todavía no está confirmada.'})
    ahora = timezone.now()
    if ahora < cita.inicio:
        raise ValidationError({
            'detail': 'Podrá modificar la cita desde su hora de inicio y hasta 30 minutos después de que termine.',
        })
    if ahora > cita.fin + timedelta(minutes=30):
        raise ValidationError({
            'detail': 'La cita ya venció. Solo puede consultar la información cargada.',
        })
    cita.estado = estado
    cita.save(update_fields=['estado', 'actualizado'])
    EventoCita.objects.create(
        cita=cita,
        tipo=EventoCita.Tipo.ATENCION if estado == Cita.Estado.ATENDIDO else EventoCita.Tipo.INASISTENCIA,
        actor=medico.usuario,
        paciente=cita.paciente,
    )
    return cita


def _franjas_horario(horario):
    """Cada cupo de la jornada, con la misma regla con la que se publican."""
    zona = timezone.get_current_timezone()
    cursor = timezone.make_aware(datetime.combine(horario.fecha, horario.hora_inicio), zona)
    limite = timezone.make_aware(datetime.combine(horario.fecha, horario.hora_fin), zona)
    paso = timedelta(minutes=horario.duracion_minutos)
    franjas = []
    while cursor + paso <= limite:
        franjas.append((cursor, cursor + paso))
        cursor += paso
    return franjas


def _contacto_paciente(paciente):
    if paciente is None:
        return None
    usuario = paciente.usuario if paciente.usuario_id else None
    tutor = paciente.tutor if paciente.tutor_id else None
    if usuario is None and tutor is not None and tutor.usuario_id:
        usuario = tutor.usuario
    return {
        'nombres': paciente.nombres,
        'apellidos': paciente.apellidos,
        'tipo_documento': paciente.tipo_documento,
        'numero_documento': paciente.numero_documento,
        'fecha_nacimiento': paciente.fecha_nacimiento.isoformat(),
        'telefono': usuario.telefono if usuario else '',
        'email': usuario.email if usuario else '',
        'tutor_nombre': tutor.nombre_completo if tutor else '',
    }


def detalle_cupos_horario(horario):
    """
    Cupos de una jornada, publicados o todavía solo asignados.

    Una cita confirmada, atendida o con inasistencia cuenta como tomada.
    Si sigue confirmada después del plazo de asistencia, se muestra como inconsistencia.
    """
    franjas = _franjas_horario(horario)
    citas = {
        cita.inicio: cita
        for cita in Cita.objects.filter(
            medico_id=horario.medico_id,
            inicio__in=[inicio for inicio, _fin in franjas],
        ).select_related('paciente__usuario', 'paciente__tutor__usuario', 'solicitante')
    }
    ahora = timezone.now()
    filas = []
    for inicio, fin in franjas:
        cita = citas.get(inicio)
        paciente = None
        motivo = ''
        solicitante = ''
        cita_id = None
        if cita is None:
            estado = 'sin_publicar' if not horario.publicada else 'no_abierto'
        else:
            cita_id = cita.id
            lease_vigente = (
                cita.estado == Cita.Estado.BLOQUEADO
                and cita.lease_expires_at
                and cita.lease_expires_at >= ahora
            )
            if cita.estado == Cita.Estado.BLOQUEADO and not lease_vigente:
                estado = 'disponible'
            elif (
                cita.estado == Cita.Estado.CONFIRMADO
                and cita.fin + timedelta(minutes=30) < ahora
            ):
                estado = 'inconsistencia'
            else:
                estado = cita.estado
            if estado not in ('disponible',):
                paciente = _contacto_paciente(cita.paciente)
                motivo = cita.motivo
                if cita.solicitante_id and cita.solicitante_id != cita.paciente_id:
                    solicitante = cita.solicitante.nombre_completo
        tomada = estado in (
            'confirmado',
            'atendido',
            'no_asistio',
            'inconsistencia',
        )
        filas.append({
            'id': cita_id,
            'inicio': timezone.localtime(inicio).isoformat(),
            'fin': timezone.localtime(fin).isoformat(),
            'estado': estado,
            'tomada': tomada,
            'motivo': motivo,
            'solicitante_nombre': solicitante,
            'paciente': paciente,
        })
    return {
        'citas': filas,
        'resumen': {
            'total': len(filas),
            'tomadas': sum(1 for fila in filas if fila['tomada']),
            'libres': sum(1 for fila in filas if fila['estado'] == 'disponible'),
        },
    }


def horarios_se_solapan(inicio_a, fin_a, inicio_b, fin_b):
    return inicio_a < fin_b and inicio_b < fin_a


def validar_horario_sin_cruce(medico, fecha, hora_inicio, hora_fin, excluir_id=None):
    existentes = Horario.objects.filter(medico=medico, fecha=fecha, activo=True)
    if excluir_id:
        existentes = existentes.exclude(pk=excluir_id)
    for horario in existentes:
        if horarios_se_solapan(hora_inicio, hora_fin, horario.hora_inicio, horario.hora_fin):
            raise ValidationError({'detail': 'El horario se cruza con otra jornada de esa misma fecha.'})


def generar_cupos(medico, desde, hasta):
    """
    Abre cupos solo para las jornadas cuya fecha cae en el rango pedido.

    El lunes 27 no reutiliza la jornada del lunes 3: cada fecha se asigna
    y se publica por separado.
    """
    if hasta < desde:
        raise ValidationError({'detail': 'La fecha final es anterior a la inicial.'})
    if (hasta - desde).days > 62:
        raise ValidationError({'detail': 'Genere cupos en rangos de máximo 62 días.'})

    hoy = timezone.localdate()
    if desde < hoy:
        desde = hoy
    horarios = list(
        Horario.objects.filter(
            medico=medico,
            activo=True,
            fecha__gte=desde,
            fecha__lte=hasta,
        )
    )
    if not horarios:
        raise ValidationError({
            'detail': 'No hay jornadas asignadas en ese rango. Primero asigne la fecha y la franja en Asignar jornada.',
        })

    zona = timezone.get_current_timezone()
    creados = 0
    fechas = set()
    for horario in horarios:
        cursor = timezone.make_aware(datetime.combine(horario.fecha, horario.hora_inicio), zona)
        limite = timezone.make_aware(datetime.combine(horario.fecha, horario.hora_fin), zona)
        paso = timedelta(minutes=horario.duracion_minutos)
        while cursor + paso <= limite:
            if cursor > timezone.now():
                _cita, creado = Cita.objects.get_or_create(
                    medico=medico,
                    inicio=cursor,
                    defaults={
                        'fin': cursor + paso,
                        'estado': Cita.Estado.DISPONIBLE,
                        'canal': 'web',
                    },
                )
                creados += int(creado)
            cursor += paso
        if not horario.publicada:
            horario.publicada = True
            horario.save(update_fields=['publicada'])
        fechas.add(horario.fecha)
    for fecha in fechas:
        invalidar_cupos(medico.id, fecha)
    return creados


def fechas_con_cupos(medico_id, usuario=None):
    """Días futuros en los que el médico aún tiene al menos un cupo libre."""
    liberar_leases_expirados()
    ahora = timezone.now()
    fechas = set(
        Cita.objects.filter(
            medico_id=medico_id,
            estado=Cita.Estado.DISPONIBLE,
            inicio__gt=ahora,
        ).dates('inicio', 'day')
    )
    if usuario is not None and usuario.is_authenticated:
        fechas.update(
            Cita.objects.filter(
                medico_id=medico_id,
                estado=Cita.Estado.BLOQUEADO,
                leased_by=usuario,
                lease_expires_at__gte=ahora,
                inicio__gt=ahora,
            ).dates('inicio', 'day')
        )
    return [fecha.isoformat() for fecha in sorted(fechas)]


def listar_cupos(medico_id, fecha, usuario=None):
    """
    Cupos de un día. La lista de disponibles se cachea en Redis por 60 segundos.
    El cupo que el propio usuario tiene arrendado se agrega fuera de la caché,
    para que pueda seguir la confirmación aunque otro proceso ya haya invalidado
    la lista compartida.
    """
    liberar_leases_expirados()
    clave = clave_cupos(medico_id, fecha)
    datos = _cache_get(clave)
    if datos is None:
        zona = timezone.get_current_timezone()
        inicio = timezone.make_aware(datetime.combine(fecha, datetime.min.time()), zona)
        fin = inicio + timedelta(days=1)
        cupos = Cita.objects.filter(
            medico_id=medico_id,
            inicio__gte=inicio,
            inicio__lt=fin,
            estado=Cita.Estado.DISPONIBLE,
        ).order_by('inicio')
        datos = [
            {
                'id': cupo.id,
                'inicio': cupo.inicio.isoformat(),
                'fin': cupo.fin.isoformat(),
                'estado': cupo.estado,
            }
            for cupo in cupos
        ]
        _cache_set(clave, datos, timeout=60)

    if usuario is not None and usuario.is_authenticated:
        propio = Cita.objects.filter(
            medico_id=medico_id,
            estado=Cita.Estado.BLOQUEADO,
            leased_by=usuario,
            lease_expires_at__gte=timezone.now(),
            inicio__date=fecha,
        ).first()
        if propio and all(item['id'] != propio.id for item in datos):
            datos = [
                *datos,
                {
                    'id': propio.id,
                    'inicio': propio.inicio.isoformat(),
                    'fin': propio.fin.isoformat(),
                    'estado': propio.estado,
                    'lease_expires_at': propio.lease_expires_at.isoformat(),
                    'propio': True,
                },
            ]
    return datos
