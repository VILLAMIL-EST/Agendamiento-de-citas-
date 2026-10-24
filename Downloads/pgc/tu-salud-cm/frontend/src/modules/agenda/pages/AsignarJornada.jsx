import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { listarMedicosAdmin } from '../../admin/services/adminService'
import { crearHorario } from '../services/agendaService'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function nombreDia(valor) {
  if (!valor) return ''
  const fecha = new Date(`${valor}T00:00:00`)
  return DIAS[fecha.getDay()]
}

export default function AsignarJornada() {
  const [medicos, setMedicos] = useState([])
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    listarMedicosAdmin()
      .then(({ data }) => setMedicos(data))
      .catch((err) => setError(mensajeError(err)))
  }, [])

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
      setFecha('')
      setAviso('La jornada quedó como propuesta. Ábrala en Cupos cuando quiera publicarla.')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Agenda</p>
      <h1>Asignar jornada</h1>
      <p className="lead">
        Indique el día, el mes y el año. El lunes 27 de octubre no se cruza con el
        lunes de la semana siguiente. Si el mismo día hay mañana y tarde, guarde
        dos jornadas con la misma fecha.
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario tarjeta" onSubmit={altaHorario} style={{ maxWidth: 520 }}>
        <label>
          Médico
          <select name="medico" required>
            <option value="">Seleccione</option>
            {medicos.map((medico) => (
              <option key={medico.id} value={medico.id}>{medico.nombres} {medico.apellidos}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha de la jornada
          <input type="date" name="fecha" required value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
        </label>
        {fecha && <p className="nota">Ese día es {nombreDia(fecha)}.</p>}
        <label>Desde<input type="time" name="hora_inicio" required /></label>
        <label>Hasta<input type="time" name="hora_fin" required /></label>
        <label>Minutos por cupo<input type="number" name="duracion_minutos" min="10" max="120" defaultValue="20" /></label>
        <button className="boton" type="submit">Guardar jornada</button>
      </form>
    </section>
  )
}
