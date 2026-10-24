import TarjetaSolicitud from './TarjetaSolicitud'

export default function AltaPacientes({ solicitudes, motivos, onMotivo, onAprobar, onRechazar }) {
  return (
    <div>
      <p className="nota">
        Estas personas ya confirmaron su correo. Valide los datos y dé de alta o rechace la cuenta.
      </p>
      <div className="lista">
        {solicitudes.map((solicitud) => (
          <TarjetaSolicitud
            key={solicitud.id}
            solicitud={solicitud}
            motivo={motivos[solicitud.id] || ''}
            onMotivo={(evento) => onMotivo(solicitud.id, evento.target.value)}
            onAprobar={() => onAprobar(solicitud.id)}
            onRechazar={() => onRechazar(solicitud.id)}
          />
        ))}
        {solicitudes.length === 0 && <p>No hay solicitudes por validar.</p>}
      </div>
    </div>
  )
}
