import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { eliminarHorario, listarHorarios } from '../services/agendaService'
import { formatearFecha } from '../utils/fechas'

const FILTROS = [
  ['propuesta', 'Propuestas'],
  ['activa', 'Activas'],
  ['vencida', 'Vencidas'],
]

const TEXTOS = {
  propuesta: 'Asignadas, todavía sin cupos publicados.',
  activa: 'Ya tienen cupos abiertos y la fecha aún no pasa.',
  vencida: 'La fecha de la jornada ya ocurrió.',
}

export default function ListaJornadas() {
  const [clasificacion, setClasificacion] = useState('propuesta')
  const [horarios, setHorarios] = useState([])
  const [error, setError] = useState('')

  function cargar(filtro = clasificacion) {
    listarHorarios(filtro)
      .then(({ data }) => setHorarios(data))
      .catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar(clasificacion) }, [clasificacion])

  async function eliminar(id) {
    setError('')
    try {
      await eliminarHorario(id)
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Seguimiento</p>
      <h1>Lista de jornadas</h1>
      <p className="lead">{TEXTOS[clasificacion]}</p>
      <Alerta>{error}</Alerta>
      <div className="pestanas">
        {FILTROS.map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            className={clasificacion === valor ? 'boton' : 'boton boton-suave'}
            onClick={() => setClasificacion(valor)}
          >
            {texto}
          </button>
        ))}
      </div>
      <div className="lista">
        {horarios.map((horario) => (
          <article key={horario.id} className="tarjeta fila-espacio">
            <div>
              <h2>{horario.medico_nombre}</h2>
              <p>
                {formatearFecha(horario.fecha)}
                {' · '}
                {horario.hora_inicio.slice(0, 5)} a {horario.hora_fin.slice(0, 5)}
                {' · '}
                {horario.duracion_minutos} min
              </p>
              <span className={`estado estado-${horario.clasificacion}`}>{horario.clasificacion}</span>
            </div>
            {horario.clasificacion === 'propuesta' && (
              <button type="button" className="boton boton-suave" onClick={() => eliminar(horario.id)}>
                Eliminar
              </button>
            )}
          </article>
        ))}
        {horarios.length === 0 && <p>No hay jornadas en este estado.</p>}
      </div>
    </section>
  )
}
