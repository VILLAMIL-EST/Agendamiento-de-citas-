import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { listarMenores } from '../../login/services/authService'
import SelectorCupo from '../components/SelectorCupo'
import { useLease } from '../hooks/useLease'
import {
  bloquearCupo,
  confirmarCupo,
  consultarDisponibilidad,
  liberarCupo,
  listarMedicos,
} from '../services/agendaService'

export default function AgendarCita() {
  const [medicos, setMedicos] = useState([])
  const [menores, setMenores] = useState([])
  const [medico, setMedico] = useState('')
  const [fecha, setFecha] = useState('')
  const [cupos, setCupos] = useState([])
  const [arrendado, setArrendado] = useState(null)
  const [pacienteId, setPacienteId] = useState('')
  const [motivo, setMotivo] = useState('Consulta de medicina general')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const { restante, texto } = useLease(arrendado?.lease_expires_at)

  useEffect(() => {
    listarMedicos().then(({ data }) => setMedicos(data)).catch((err) => setError(mensajeError(err)))
    listarMenores().then(({ data }) => setMenores(data)).catch(() => setMenores([]))
  }, [])

  async function buscarCupos(evento) {
    evento?.preventDefault()
    setError('')
    setAviso('')
    try {
      const { data } = await consultarDisponibilidad(medico, fecha)
      setCupos(data.cupos)
      const propio = data.cupos.find((cupo) => cupo.propio)
      if (propio) setArrendado(propio)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function bloquear(cupo) {
    setError('')
    setAviso('')
    try {
      const { data } = await bloquearCupo(cupo.id)
      setArrendado(data)
    } catch (err) {
      setError(mensajeError(err))
      buscarCupos()
    }
  }

  async function confirmar(evento) {
    evento.preventDefault()
    setError('')
    try {
      await confirmarCupo(arrendado.id, {
        paciente_id: pacienteId || null,
        motivo,
      })
      setArrendado(null)
      setAviso('La cita quedó confirmada.')
      buscarCupos()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function soltar() {
    try {
      await liberarCupo(arrendado.id)
    } catch {
      // Si el arrendamiento ya venció, el cupo vuelve solo a la oferta.
    }
    setArrendado(null)
    buscarCupos()
  }

  useEffect(() => {
    if (!arrendado?.lease_expires_at) return undefined
    const vence = new Date(arrendado.lease_expires_at).getTime()
    const id = window.setInterval(() => {
      if (Date.now() >= vence) {
        setArrendado(null)
        setError('El tiempo para confirmar se agotó. El cupo quedó libre.')
        if (medico && fecha) buscarCupos()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [arrendado?.id])

  return (
    <section>
      <p className="sobrelinea">Canal web</p>
      <h1>Agendar cita</h1>
      <p className="lead">El cupo se reserva cinco minutos mientras confirma. Nadie más puede tomarlo durante ese tiempo.</p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario fila" onSubmit={buscarCupos}>
        <label>
          Médico
          <select value={medico} onChange={(e) => setMedico(e.target.value)} required>
            <option value="">Seleccione</option>
            {medicos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombres} {item.apellidos} — {item.especialidad}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <button className="boton" type="submit">Ver cupos</button>
      </form>

      <SelectorCupo cupos={cupos} onElegir={bloquear} />
      {medico && fecha && cupos.filter((cupo) => !cupo.propio).length === 0 && (
        <p>No hay cupos libres en esa fecha.</p>
      )}

      {arrendado && restante > 0 && (
        <form className="tarjeta" onSubmit={confirmar}>
          <h2>Cupo reservado · {texto}</h2>
          <p>Confirme antes de que el contador llegue a cero.</p>
          <label>
            La cita es para
            <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
              <option value="">Mí</option>
              {menores.map((menor) => (
                <option key={menor.id} value={menor.id}>{menor.nombres} {menor.apellidos}</option>
              ))}
            </select>
          </label>
          <label>
            Motivo
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={180} />
          </label>
          <div className="fila">
            <button className="boton" type="submit">Confirmar cita</button>
            <button className="boton boton-suave" type="button" onClick={soltar}>Soltar cupo</button>
          </div>
        </form>
      )}
    </section>
  )
}
