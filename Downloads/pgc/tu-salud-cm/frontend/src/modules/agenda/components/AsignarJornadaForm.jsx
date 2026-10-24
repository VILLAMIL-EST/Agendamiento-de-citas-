import { useMemo, useState } from 'react'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function nombreDia(fecha) {
  if (!fecha) return ''
  const js = new Date(`${fecha}T00:00:00`).getDay()
  return DIAS[js === 0 ? 6 : js - 1]
}

export default function AsignarJornadaForm({ medicos, onSubmit }) {
  const [fecha, setFecha] = useState('')
  const dia = useMemo(() => nombreDia(fecha), [fecha])

  return (
    <form className="formulario tarjeta apartado-panel" onSubmit={onSubmit}>
      <h2>Asignar jornada</h2>
      <p className="nota">
        Indique el día exacto (fecha). El lunes 27 no se mezcla con el lunes de la semana siguiente.
        Si el mismo día hay mañana y tarde, guarde dos jornadas.
      </p>
      <label>
        Médico
        <select name="medico" required>
          <option value="">Seleccione</option>
          {medicos.map((medico) => (
            <option key={medico.id} value={medico.id}>
              {medico.nombres} {medico.apellidos}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha
        <input type="date" name="fecha" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>
      {dia && <p className="nota">Ese día es {dia}.</p>}
      <label>Desde<input type="time" name="hora_inicio" required /></label>
      <label>Hasta<input type="time" name="hora_fin" required /></label>
      <label>Minutos por cupo<input type="number" name="duracion_minutos" min="10" max="120" defaultValue="20" /></label>
      <button className="boton" type="submit">Guardar jornada</button>
    </form>
  )
}
