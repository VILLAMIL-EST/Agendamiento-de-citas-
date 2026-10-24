import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { crearMedico, listarMedicosAdmin } from '../../admin/services/adminService'
import AbrirCuposForm from '../components/AbrirCuposForm'
import AsignarJornadaForm from '../components/AsignarJornadaForm'
import ListaJornadas from '../components/ListaJornadas'
import RegistroMedicoForm from '../components/RegistroMedicoForm'
import {
  crearHorario,
  eliminarHorario,
  generarCupos,
  listarHorarios,
} from '../services/agendaService'

const APARTADOS = [
  ['medico', 'Registro de médico'],
  ['jornada', 'Asignar jornada'],
  ['cupos', 'Abrir cupos'],
  ['lista', 'Lista de jornadas'],
]

export default function Horarios() {
  const [params, setParams] = useSearchParams()
  const apartado = APARTADOS.some(([clave]) => clave === params.get('apartado'))
    ? params.get('apartado')
    : 'medico'
  const [medicos, setMedicos] = useState([])
  const [horarios, setHorarios] = useState([])
  const [filtro, setFiltro] = useState('todas')
  const [documento, setDocumento] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function irA(clave) {
    setParams({ apartado: clave })
  }

  function cargar() {
    listarMedicosAdmin().then(({ data }) => setMedicos(data)).catch((err) => setError(mensajeError(err)))
    listarHorarios().then(({ data }) => setHorarios(data)).catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar() }, [])

  async function altaMedico(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    const payload = Object.fromEntries(new FormData(evento.target).entries())
    try {
      await crearMedico(payload)
      evento.target.reset()
      setAviso('El profesional quedó habilitado en el canal web.')
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function altaHorario(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    const payload = Object.fromEntries(new FormData(evento.target).entries())
    payload.duracion_minutos = Number(payload.duracion_minutos)
    payload.activo = true
    try {
      await crearHorario(payload)
      evento.target.reset()
      setAviso('Jornada guardada como propuesta. Ábrala en Cupos cuando quiera publicarla.')
      cargar()
      irA('lista')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function abrirCupos(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    const payload = Object.fromEntries(new FormData(evento.target).entries())
    try {
      const { data } = await generarCupos(payload)
      setAviso(`Se abrieron ${data.cupos_creados} cupos. Esas jornadas pasaron a activas.`)
      cargar()
      irA('lista')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function eliminar(id) {
    setError('')
    setAviso('')
    try {
      await eliminarHorario(id)
      setAviso('La jornada se eliminó.')
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Oferta del canal web</p>
      <h1>Horarios</h1>
      <p className="lead">
        Primero registre al médico, luego asigne la jornada con fecha, abra los cupos de esa semana
        y revise el estado en la lista.
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
      {apartado === 'medico' && <RegistroMedicoForm onSubmit={altaMedico} />}
      {apartado === 'jornada' && <AsignarJornadaForm medicos={medicos} onSubmit={altaHorario} />}
      {apartado === 'cupos' && <AbrirCuposForm medicos={medicos} onSubmit={abrirCupos} />}
      {apartado === 'lista' && (
        <ListaJornadas
          horarios={horarios}
          filtro={filtro}
          documento={documento}
          onFiltro={setFiltro}
          onDocumento={setDocumento}
          onEliminar={eliminar}
        />
      )}
    </section>
  )
}
