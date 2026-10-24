import { useEffect, useMemo, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { listarMedicosAdmin } from '../../admin/services/adminService'
import { generarCupos, listarHorarios } from '../services/agendaService'
import { formatearFecha } from '../utils/fechas'

export default function AbrirCupos() {
  const [medicos, setMedicos] = useState([])
  const [horarios, setHorarios] = useState([])
  const [medico, setMedico] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    listarMedicosAdmin().then(({ data }) => setMedicos(data)).catch((err) => setError(mensajeError(err)))
    listarHorarios().then(({ data }) => setHorarios(data)).catch((err) => setError(mensajeError(err)))
  }, [])

  const propuestas = useMemo(() => {
    return horarios.filter((horario) => {
      if (horario.clasificacion !== 'propuesta') return false
      if (medico && String(horario.medico) !== String(medico)) return false
      if (desde && horario.fecha < desde) return false
      if (hasta && horario.fecha > hasta) return false
      return true
    })
  }, [horarios, medico, desde, hasta])

  async function abrirCupos(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    try {
      const { data } = await generarCupos({ medico, desde, hasta })
      const { data: lista } = await listarHorarios()
      setHorarios(lista)
      setAviso(`Se abrieron ${data.cupos_creados} cupos. La siguiente semana se asigna y publica aparte.`)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Publicación</p>
      <h1>Abrir cupos</h1>
      <p className="lead">
        Publique solo el rango que necesite, por ejemplo una semana. Las jornadas
        de otras fechas no se tocan. Cuando llegue la semana siguiente, asigne
        esas jornadas y vuelva a abrir cupos.
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario tarjeta" onSubmit={abrirCupos} style={{ maxWidth: 520 }}>
        <label>
          Médico
          <select name="medico" required value={medico} onChange={(evento) => setMedico(evento.target.value)}>
            <option value="">Seleccione</option>
            {medicos.map((item) => (
              <option key={item.id} value={item.id}>{item.nombres} {item.apellidos}</option>
            ))}
          </select>
        </label>
        <label>Desde<input type="date" name="desde" required value={desde} onChange={(evento) => setDesde(evento.target.value)} /></label>
        <label>Hasta<input type="date" name="hasta" required value={hasta} onChange={(evento) => setHasta(evento.target.value)} /></label>
        <button className="boton" type="submit">Publicar cupos</button>
      </form>

      <div className="lista" style={{ marginTop: '1.2rem' }}>
        <h2>Jornadas que se publicarán</h2>
        {propuestas.map((horario) => (
          <article key={horario.id} className="tarjeta">
            <p>
              <strong>{horario.medico_nombre}</strong>
              {' · '}
              {formatearFecha(horario.fecha)}
              {' · '}
              {horario.hora_inicio.slice(0, 5)} a {horario.hora_fin.slice(0, 5)}
            </p>
          </article>
        ))}
        {propuestas.length === 0 && (
          <p className="nota">No hay jornadas propuestas en ese rango. Primero asígnelas en Jornada.</p>
        )}
      </div>
    </section>
  )
}
