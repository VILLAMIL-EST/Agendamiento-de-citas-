export default function AltaTutores({ solicitudes, motivos, onMotivo, onAprobar, onRechazar, onVerDocumento }) {
  return (
    <div>
      <p className="nota">
        El titular pidió quedar como tutor. Revise la foto o el PDF del documento del menor
        (TI o registro civil) antes de aprobar. Hasta entonces el menor no existe en citas ni resultados.
      </p>
      <div className="lista">
        {solicitudes.map((solicitud) => (
          <article key={solicitud.id} className="tarjeta">
            <h2>{solicitud.nombres} {solicitud.apellidos}</h2>
            <p>{solicitud.tipo_documento} {solicitud.numero_documento}</p>
            <p>Nacimiento: {solicitud.fecha_nacimiento}</p>
            <p>Tutor: {solicitud.tutor_nombre} · doc. {solicitud.tutor_documento}</p>
            <button type="button" className="enlace" onClick={() => onVerDocumento(solicitud.id)}>
              Ver documento adjunto
            </button>
            <label>
              Motivo del rechazo, si aplica
              <input
                value={motivos[solicitud.id] || ''}
                onChange={(evento) => onMotivo(solicitud.id, evento.target.value)}
              />
            </label>
            <div className="fila">
              <button type="button" className="boton" onClick={() => onAprobar(solicitud.id)}>Aprobar tutela</button>
              <button type="button" className="boton boton-suave" onClick={() => onRechazar(solicitud.id)}>Rechazar</button>
            </div>
          </article>
        ))}
        {solicitudes.length === 0 && <p>No hay solicitudes de tutela por validar.</p>}
      </div>
    </div>
  )
}
