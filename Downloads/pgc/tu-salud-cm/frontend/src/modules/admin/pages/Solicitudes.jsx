import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import AltaPacientes from '../components/AltaPacientes'
import AltaTutores from '../components/AltaTutores'
import HistorialSolicitudes from '../components/HistorialSolicitudes'
import HistorialTutores from '../components/HistorialTutores'
import {
  aprobarSolicitud,
  aprobarTutela,
  descargarSoporteTutela,
  listarHistorialSolicitudes,
  listarSolicitudes,
  listarSolicitudesTutelaAdmin,
  rechazarSolicitud,
  rechazarTutela,
} from '../services/adminService'

const APARTADOS = [
  ['alta', 'Dar de alta'],
  ['tutores', 'Tutores'],
  ['historial', 'Historial'],
]

export default function Solicitudes() {
  const [params, setParams] = useSearchParams()
  const apartado = APARTADOS.some(([clave]) => clave === params.get('apartado'))
    ? params.get('apartado')
    : 'alta'
  const [solicitudes, setSolicitudes] = useState([])
  const [historial, setHistorial] = useState([])
  const [tutelasPendientes, setTutelasPendientes] = useState([])
  const [tutelasHistorial, setTutelasHistorial] = useState([])
  const [vistaTutela, setVistaTutela] = useState('pendientes')
  const [motivos, setMotivos] = useState({})
  const [motivosTutela, setMotivosTutela] = useState({})
  const [documento, setDocumento] = useState('')
  const [documentoTutela, setDocumentoTutela] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [filtroTutela, setFiltroTutela] = useState('todas')
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
    listarSolicitudesTutelaAdmin()
      .then(({ data }) => setTutelasPendientes(data))
      .catch((err) => setError(mensajeError(err)))
    listarSolicitudesTutelaAdmin({ vista: 'historial' })
      .then(({ data }) => setTutelasHistorial(data))
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

  async function aprobarMenor(id) {
    setError('')
    setAviso('')
    try {
      const { data } = await aprobarTutela(id)
      setAviso(data.detail)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function rechazarMenor(id) {
    setError('')
    setAviso('')
    try {
      const { data } = await rechazarTutela(id, motivosTutela[id] || '')
      setAviso(data.detail)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function verDocumento(id) {
    setError('')
    try {
      const respuesta = await descargarSoporteTutela(id)
      const tipo = respuesta.headers['content-type'] || 'application/octet-stream'
      const url = URL.createObjectURL(new Blob([respuesta.data], { type: tipo }))
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Altas de pacientes</p>
      <h1>Solicitudes</h1>
      <p className="lead">
        Valide las altas de titulares, las solicitudes de tutela de menores y consulte el historial por documento.
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
      {apartado === 'tutores' && (
        <>
          <div className="subapartados">
            <button
              type="button"
              className={vistaTutela === 'pendientes' ? 'boton' : 'boton boton-suave'}
              onClick={() => setVistaTutela('pendientes')}
            >
              Pendientes
            </button>
            <button
              type="button"
              className={vistaTutela === 'historial' ? 'boton' : 'boton boton-suave'}
              onClick={() => setVistaTutela('historial')}
            >
              Historial
            </button>
          </div>
          {vistaTutela === 'pendientes' ? (
            <AltaTutores
              solicitudes={tutelasPendientes}
              motivos={motivosTutela}
              onMotivo={(id, valor) => setMotivosTutela((previo) => ({ ...previo, [id]: valor }))}
              onAprobar={aprobarMenor}
              onRechazar={rechazarMenor}
              onVerDocumento={verDocumento}
            />
          ) : (
            <HistorialTutores
              solicitudes={tutelasHistorial}
              documento={documentoTutela}
              filtro={filtroTutela}
              onDocumento={setDocumentoTutela}
              onFiltro={setFiltroTutela}
              onVerDocumento={verDocumento}
            />
          )}
        </>
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
