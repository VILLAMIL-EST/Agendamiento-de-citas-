export default function TarjetaSolicitud({ solicitud, motivo, onMotivo, onAprobar, onRechazar }) {
  return (
    <article className="tarjeta">
      <h2>{solicitud.nombres} {solicitud.apellidos}</h2>
      <p>{solicitud.email}</p>
      <p>Documento {solicitud.numero_documento || 'sin perfil'}</p>
      <label>
        Motivo del rechazo, si aplica
        <input value={motivo} onChange={onMotivo} />
      </label>
      <div className="fila">
        <button type="button" className="boton" onClick={onAprobar}>Aprobar</button>
        <button type="button" className="boton boton-suave" onClick={onRechazar}>Rechazar</button>
      </div>
    </article>
  )
}
