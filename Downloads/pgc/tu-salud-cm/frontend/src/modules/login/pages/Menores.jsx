import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { crearMenor, listarMenores } from '../services/authService'

const INICIAL = {
  nombres: '',
  apellidos: '',
  tipo_documento: 'TI',
  numero_documento: '',
  fecha_nacimiento: '',
}

export default function Menores() {
  const [menores, setMenores] = useState([])
  const [datos, setDatos] = useState(INICIAL)
  const [error, setError] = useState('')

  function cargar() {
    listarMenores().then(({ data }) => setMenores(data)).catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar() }, [])

  function cambiar(evento) {
    setDatos((previo) => ({ ...previo, [evento.target.name]: evento.target.value }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    try {
      await crearMenor(datos)
      setDatos(INICIAL)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Tutores</p>
      <h1>Menores a cargo</h1>
      <p className="lead">Puede agendar citas y consultar resultados de estos perfiles. Ellos no tienen una cuenta propia.</p>
      <Alerta>{error}</Alerta>
      <form className="formulario grilla-form" onSubmit={enviar}>
        <label>Nombres<input name="nombres" value={datos.nombres} onChange={cambiar} required /></label>
        <label>Apellidos<input name="apellidos" value={datos.apellidos} onChange={cambiar} required /></label>
        <label>
          Documento
          <select name="tipo_documento" value={datos.tipo_documento} onChange={cambiar}>
            <option value="TI">Tarjeta de identidad</option>
            <option value="RC">Registro civil</option>
          </select>
        </label>
        <label>Número<input name="numero_documento" value={datos.numero_documento} onChange={cambiar} required /></label>
        <label>Nacimiento<input type="date" name="fecha_nacimiento" value={datos.fecha_nacimiento} onChange={cambiar} required /></label>
        <button className="boton" type="submit">Agregar menor</button>
      </form>
      <div className="lista">
        {menores.map((menor) => (
          <article key={menor.id} className="tarjeta">
            <h2>{menor.nombres} {menor.apellidos}</h2>
            <p>{menor.tipo_documento} {menor.numero_documento}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
