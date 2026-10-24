import { useEffect, useState } from 'react'
import esLocale from '@fullcalendar/core/locales/es'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { calendarioMedico, registrarAsistencia } from '../services/agendaService'

export default function CalendarioSemanal() {
  const [eventos, setEventos] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar(info) {
    const params = {}
    if (info?.startStr) params.desde = info.startStr.slice(0, 10)
    if (info?.endStr) params.hasta = info.endStr.slice(0, 10)
    calendarioMedico(params)
      .then(({ data }) => setEventos(data))
      .catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar() }, [])

  async function marcar(id, estado) {
    setError('')
    try {
      await registrarAsistencia(id, estado)
      setAviso(estado === 'atendido' ? 'La cita quedó como atendida.' : 'La cita quedó como no asistencia.')
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Agenda del canal web</p>
      <h1>Calendario semanal</h1>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <div className="calendario">
        <FullCalendar
          plugins={[timeGridPlugin]}
          initialView="timeGridWeek"
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay',
          }}
          slotMinTime="07:00:00"
          slotMaxTime="18:00:00"
          allDaySlot={false}
          height="auto"
          events={eventos}
          datesSet={cargar}
          eventClick={(info) => {
            setSeleccion({
              id: info.event.id,
              title: info.event.title,
              estado: info.event.extendedProps.estado,
            })
          }}
          eventClassNames={(arg) => [`evento-${arg.event.extendedProps.estado}`]}
        />
      </div>
      {seleccion && (
        <article className="tarjeta">
          <h2>{seleccion.title}</h2>
          <p>Estado actual: {String(seleccion.estado || '').replace('_', ' ')}</p>
          <div className="fila">
            <button type="button" className="boton" onClick={() => marcar(seleccion.id, 'atendido')}>Marcar atendida</button>
            <button type="button" className="boton boton-suave" onClick={() => marcar(seleccion.id, 'no_asistio')}>No asistió</button>
          </div>
        </article>
      )}
      <p className="nota">Pulse una cita para registrar si el paciente asistió.</p>
    </section>
  )
}
