function horaDe(inicio) {
  return new Date(inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function grupos(cupos) {
  const libres = cupos.filter((cupo) => !cupo.propio)
  const manana = libres.filter((cupo) => new Date(cupo.inicio).getHours() < 12)
  const tarde = libres.filter((cupo) => new Date(cupo.inicio).getHours() >= 12)
  return [
    ['Mañana', manana],
    ['Tarde', tarde],
  ].filter(([, lista]) => lista.length > 0)
}

export default function SelectorCupo({ cupos, onElegir }) {
  const bloques = grupos(cupos)
  if (bloques.length === 0) return null
  return (
    <div className="tablero-cupos">
      {bloques.map(([titulo, lista]) => (
        <div key={titulo}>
          <p className="sobrelinea">{titulo}</p>
          <div className="cupos">
            {lista.map((cupo) => (
              <button key={cupo.id} type="button" className="cupo" onClick={() => onElegir(cupo)}>
                {horaDe(cupo.inicio)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
