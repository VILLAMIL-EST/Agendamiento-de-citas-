export default function SelectorCupo({ cupos, onElegir }) {
  const libres = cupos.filter((cupo) => !cupo.propio)
  return (
    <div className="cupos">
      {libres.map((cupo) => (
        <button key={cupo.id} type="button" className="cupo" onClick={() => onElegir(cupo)}>
          {new Date(cupo.inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </button>
      ))}
    </div>
  )
}
