export default function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status">
      <span className="cargando-marca" />
      <p>{texto}</p>
    </div>
  )
}
