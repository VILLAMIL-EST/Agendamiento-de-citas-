export default function TarjetaResultado({ item, onDescargar }) {
  return (
    <article className="tarjeta">
      <h2>{item.titulo}</h2>
      <p>{item.paciente_nombre} · {item.medico_nombre}</p>
      <p>{item.fecha_resultado} · {item.tipo}</p>
      <button type="button" className="boton" onClick={() => onDescargar(item.id)}>Descargar PDF</button>
    </article>
  )
}
