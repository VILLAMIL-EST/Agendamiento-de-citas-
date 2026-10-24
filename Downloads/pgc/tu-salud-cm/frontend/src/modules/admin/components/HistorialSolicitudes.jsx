const GRUPOS = [
  ['pendiente', 'Pendientes'],
  ['activo', 'Activos'],
  ['rechazado', 'Rechazados'],
]

const ETIQUETAS = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  rechazado: 'Rechazado',
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

export default function HistorialSolicitudes({ solicitudes, documento, filtro, onDocumento, onFiltro }) {
  const porDocumento = solicitudes.filter((item) => coincideDocumento(item.numero_documento, documento))
  const visibles = filtro === 'todas'
    ? porDocumento
    : porDocumento.filter((item) => item.clasificacion === filtro)

  return (
    <div>
      <label className="filtro-documento">
        Filtrar por documento
        <input
          type="text"
          inputMode="numeric"
          value={documento}
          onChange={(evento) => onDocumento(evento.target.value)}
          placeholder="Escriba la cédula"
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
            <p>{solicitud.email}</p>
            <p>Documento {solicitud.numero_documento || 'sin perfil'}</p>
            <p>Registrado el {formatearFecha(solicitud.creado)}</p>
            {solicitud.fecha_aprobacion && (
              <p>Decisión el {formatearFecha(solicitud.fecha_aprobacion)}</p>
            )}
            {solicitud.motivo_rechazo && <p>Motivo: {solicitud.motivo_rechazo}</p>}
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
