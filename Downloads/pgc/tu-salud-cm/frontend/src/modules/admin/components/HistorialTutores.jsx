const GRUPOS = [
  ['pendiente', 'Pendientes'],
  ['activo', 'Aprobadas'],
  ['rechazado', 'Rechazadas'],
]

const ETIQUETAS = {
  pendiente: 'Pendiente',
  activo: 'Aprobada',
  rechazado: 'Rechazada',
}

function coincideDocumento(valor, busqueda) {
  const limpio = String(busqueda || '').replace(/\D/g, '')
  if (!limpio) return true
  return String(valor || '').replace(/\D/g, '').includes(limpio)
}

function formatearFecha(valor) {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleDateString('es-CO')
}

export default function HistorialTutores({ solicitudes, documento, filtro, onDocumento, onFiltro, onVerDocumento }) {
  const porDocumento = solicitudes.filter((item) => (
    coincideDocumento(item.numero_documento, documento)
    || coincideDocumento(item.tutor_documento, documento)
  ))
  const visibles = filtro === 'todas'
    ? porDocumento
    : porDocumento.filter((item) => item.clasificacion === filtro)

  return (
    <div>
      <label className="filtro-documento">
        Filtrar por documento del menor o del tutor
        <input
          type="text"
          inputMode="numeric"
          value={documento}
          onChange={(evento) => onDocumento(evento.target.value)}
          placeholder="Escriba el documento"
        />
      </label>
      <div className="subapartados">
        <button type="button" className={filtro === 'todas' ? 'boton' : 'boton boton-suave'} onClick={() => onFiltro('todas')}>
          Todas ({porDocumento.length})
        </button>
        {GRUPOS.map(([clave, titulo]) => (
          <button
            key={clave}
            type="button"
            className={filtro === clave ? 'boton' : 'boton boton-suave'}
            onClick={() => onFiltro(clave)}
          >
            {titulo} ({porDocumento.filter((item) => item.clasificacion === clave).length})
          </button>
        ))}
      </div>
      <div className="lista">
        {visibles.map((solicitud) => (
          <article key={solicitud.id} className="tarjeta">
            <h2>{solicitud.nombres} {solicitud.apellidos}</h2>
            <p>{solicitud.tipo_documento} {solicitud.numero_documento}</p>
            <p>Tutor: {solicitud.tutor_nombre} · doc. {solicitud.tutor_documento}</p>
            <p>Enviada el {formatearFecha(solicitud.creado)}</p>
            {solicitud.fecha_decision && <p>Decisión el {formatearFecha(solicitud.fecha_decision)}</p>}
            {solicitud.motivo_rechazo && <p>Motivo: {solicitud.motivo_rechazo}</p>}
            {solicitud.tiene_soporte && (
              <button type="button" className="enlace" onClick={() => onVerDocumento(solicitud.id)}>
                Ver documento adjunto
              </button>
            )}
            <span className={`estado estado-${solicitud.clasificacion}`}>
              {ETIQUETAS[solicitud.clasificacion] || solicitud.clasificacion}
            </span>
          </article>
        ))}
        {visibles.length === 0 && <p>No hay registros con ese criterio.</p>}
      </div>
    </div>
  )
}
