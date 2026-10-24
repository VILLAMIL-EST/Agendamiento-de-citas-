import { useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import TarjetaResultado from '../components/TarjetaResultado'
import { buscarResultados, descargarResultado } from '../services/clinicaService'

export default function Resultados() {
  const [filtros, setFiltros] = useState({ nombre: '', fecha: '', doctor: '' })
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  const [busco, setBusco] = useState(false)
  const [cargando, setCargando] = useState(false)

  function cambiar(evento) {
    setFiltros((previo) => ({ ...previo, [evento.target.name]: evento.target.value }))
  }

  async function buscar(evento) {
    evento.preventDefault()
    setError('')
    setCargando(true)
    try {
      const { data } = await buscarResultados(filtros)
      setResultados(data)
      setBusco(true)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  async function descargar(id) {
    setError('')
    try {
      const respuesta = await descargarResultado(id)
      const url = URL.createObjectURL(respuesta.data)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `resultado-${id}.pdf`
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Repositorio digital</p>
      <h1>Resultados clínicos</h1>
      <p className="lead">
        El PDF descargado está cifrado. Ábralo con el número de documento del paciente al que pertenece.
      </p>
      <Alerta>{error}</Alerta>
      <form className="formulario fila" onSubmit={buscar}>
        <label>Nombre<input name="nombre" value={filtros.nombre} onChange={cambiar} /></label>
        <label>Fecha<input type="date" name="fecha" value={filtros.fecha} onChange={cambiar} /></label>
        <label>Médico<input name="doctor" value={filtros.doctor} onChange={cambiar} /></label>
        <button className="boton" type="submit">Buscar</button>
      </form>
      <div className="lista">
        {resultados.map((item) => (
          <TarjetaResultado key={item.id} item={item} onDescargar={descargar} />
        ))}
        {cargando && <p>Buscando resultados…</p>}
        {busco && !cargando && resultados.length === 0 && <p>No hay resultados con esos filtros.</p>}
      </div>
    </section>
  )
}
