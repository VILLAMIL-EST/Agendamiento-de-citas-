import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { cancelarCita, listarMisCitas } from '../services/agendaService'

export default function MisCitas() {
  const [citas, setCitas] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar() {
    listarMisCitas()
      .then(({ data }) => setCitas(data))
      .catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar() }, [])

  async function cancelar(id) {
    setError('')
    setAviso('')
    try {
      const { data } = await cancelarCita(id)
      setAviso(data.detail)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Seguimiento</p>
      <h1>Mis citas</h1>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <div className="lista">
        {citas.map((cita) => {
          const futura = new Date(cita.inicio) > new Date() && cita.estado === 'confirmado'
          return (
            <article key={cita.id} className="tarjeta">
              <h2>{new Date(cita.inicio).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</h2>
              <p>{cita.medico_nombre} · {cita.especialidad}</p>
              <p>Paciente: {cita.paciente_nombre}</p>
              <p className={`estado estado-${cita.estado}`}>{cita.estado.replace('_', ' ')}</p>
              {futura && (
                <button type="button" className="boton boton-suave" onClick={() => cancelar(cita.id)}>
                  Cancelar
                </button>
              )}
            </article>
          )
        })}
        {citas.length === 0 && <p>Todavía no tiene citas confirmadas.</p>}
      </div>
    </section>
  )
}
