import { useCallback, useEffect, useRef, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { useAuth } from '../../../hooks/useAuth'
import { mensajeError } from '../../../services/api'
import { listarMenores, obtenerYo } from '../../login/services/authService'
import TarjetaResultado from '../components/TarjetaResultado'
import { buscarResultados, descargarResultado } from '../services/clinicaService'

export default function Resultados() {
  const { usuario } = useAuth()
  const [menores, setMenores] = useState([])
  const [listoMenores, setListoMenores] = useState(false)
  const [pacienteId, setPacienteId] = useState(usuario?.paciente_id ? String(usuario.paciente_id) : '')
  const [filtros, setFiltros] = useState({
    paciente: usuario?.paciente_id ? String(usuario.paciente_id) : '',
    fecha: '',
    doctor: '',
  })
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  const [busco, setBusco] = useState(false)
  const [cargando, setCargando] = useState(false)
  const tieneDependientes = menores.length > 0
  const nombrePropio = `${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim()
  const filtrosRef = useRef(filtros)
  filtrosRef.current = filtros

  const consultar = useCallback(async ({ paciente, fecha, doctor } = {}) => {
    const params = {}
    if (fecha) params.fecha = fecha
    if (doctor) params.doctor = doctor
    if (paciente) params.paciente = paciente
    setError('')
    setCargando(true)
    try {
      const { data } = await buscarResultados(params)
      setResultados(data)
      setBusco(true)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let activo = true
    Promise.all([
      listarMenores().then(({ data }) => data).catch(() => []),
      usuario?.paciente_id
        ? Promise.resolve(usuario.paciente_id)
        : obtenerYo().then(({ data }) => data.paciente_id).catch(() => null),
    ])
      .then(([lista, id]) => {
        if (!activo) return
        setMenores(lista)
        if (id) {
          const valor = String(id)
          setPacienteId(valor)
          setFiltros((previo) => (
            previo.paciente === valor ? previo : { ...previo, paciente: valor }
          ))
        }
      })
      .finally(() => {
        if (activo) setListoMenores(true)
      })
    return () => {
      activo = false
    }
  }, [usuario])

  useEffect(() => {
    if (!listoMenores) return
    const elegido = filtros.paciente || pacienteId
    if (!elegido) return
    consultar({
      paciente: elegido,
      fecha: filtrosRef.current.fecha,
      doctor: filtrosRef.current.doctor.trim(),
    })
  }, [consultar, listoMenores, filtros.paciente, pacienteId])

  function cambiar(evento) {
    setFiltros((previo) => ({ ...previo, [evento.target.name]: evento.target.value }))
  }

  function filtrar(evento) {
    evento.preventDefault()
    const elegido = tieneDependientes ? filtros.paciente : (filtros.paciente || pacienteId)
    consultar({
      paciente: elegido,
      fecha: filtros.fecha,
      doctor: filtros.doctor.trim(),
    })
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
      {listoMenores && !tieneDependientes && (
        <p className="paciente-atender">Resultados de: {nombrePropio}</p>
      )}
      <form className="formulario fila fila-filtros" onSubmit={filtrar}>
        {tieneDependientes && (
          <label>
            Nombre
            <select name="paciente" value={filtros.paciente} onChange={cambiar}>
              <option value={usuario?.paciente_id || pacienteId}>{nombrePropio}</option>
              {menores.map((menor) => (
                <option key={menor.id} value={menor.id}>
                  {menor.nombres} {menor.apellidos}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>Fecha<input type="date" name="fecha" value={filtros.fecha} onChange={cambiar} /></label>
        <label>Médico<input name="doctor" value={filtros.doctor} onChange={cambiar} /></label>
        <button className="boton" type="submit">Filtrar</button>
      </form>
      <div className="lista">
        {resultados.map((item) => (
          <TarjetaResultado key={item.id} item={item} onDescargar={descargar} />
        ))}
        {cargando && <p>Cargando resultados…</p>}
        {busco && !cargando && resultados.length === 0 && (
          <p>No hay resultados clínicos{filtros.fecha || filtros.doctor ? ' con esos filtros' : ''}.</p>
        )}
      </div>
    </section>
  )
}
