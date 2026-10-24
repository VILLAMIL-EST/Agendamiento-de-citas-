import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import AltaPacientes from '../components/AltaPacientes'
import HistorialSolicitudes from '../components/HistorialSolicitudes'
import {
  aprobarSolicitud,
  listarHistorialSolicitudes,
  listarSolicitudes,
  rechazarSolicitud,
} from '../services/adminService'

const APARTADOS = [
  ['alta', 'Dar de alta'],
  ['historial', 'Historial'],
]

export default function Solicitudes() {
  const [params, setParams] = useSearchParams()
  const apartado = APARTADOS.some(([clave]) => clave === params.get('apartado'))
    ? params.get('apartado')
    : 'alta'
  const [solicitudes, setSolicitudes] = useState([])
  const [historial, setHistorial] = useState([])
  const [motivos, setMotivos] = useState({})
  const [documento, setDocumento] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function irA(clave) {
    setParams({ apartado: clave })
  }

  function cargar() {
    listarSolicitudes()
      .then(({ data }) => setSolicitudes(data))
      .catch((err) => setError(mensajeError(err)))
    listarHistorialSolicitudes()
      .then(({ data }) => setHistorial(data))
      .catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar() }, [])

  async function aprobar(id) {
    setError('')
    setAviso('')
    try {
      const { data } = await aprobarSolicitud(id)
      setAviso(data.detail)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function rechazar(id) {
    setError('')
    setAviso('')
    try {
      const { data } = await rechazarSolicitud(id, motivos[id] || '')
      setAviso(data.detail)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Altas de pacientes</p>
      <h1>Solicitudes</h1>
      <p className="lead">
        Valide las altas nuevas y consulte el historial por documento para ver si quedaron pendientes, activas o rechazadas.
      </p>
      <div className="subapartados">
        {APARTADOS.map(([clave, titulo]) => (
          <button
            key={clave}
            type="button"
            className={apartado === clave ? 'boton' : 'boton boton-suave'}
            onClick={() => {
              setError('')
              setAviso('')
              irA(clave)
            }}
          >
            {titulo}
          </button>
        ))}
      </div>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      {apartado === 'alta' && (
        <AltaPacientes
          solicitudes={solicitudes}
          motivos={motivos}
          onMotivo={(id, valor) => setMotivos((previo) => ({ ...previo, [id]: valor }))}
          onAprobar={aprobar}
          onRechazar={rechazar}
        />
      )}
      {apartado === 'historial' && (
        <HistorialSolicitudes
          solicitudes={historial}
          documento={documento}
          filtro={filtro}
          onDocumento={setDocumento}
          onFiltro={setFiltro}
        />
      )}
    </section>
  )
}
