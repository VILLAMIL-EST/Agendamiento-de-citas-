export default function AbrirCuposForm({ medicos, onSubmit }) {
  return (
    <form className="formulario tarjeta apartado-panel" onSubmit={onSubmit}>
      <h2>Abrir cupos</h2>
      <p className="nota">
        Publica solo las jornadas ya asignadas dentro del rango. Para una semana, ponga el lunes y el domingo
        de esa semana. La semana siguiente se abre después, cuando asigne esas fechas.
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
      <label>Desde<input type="date" name="desde" required /></label>
      <label>Hasta<input type="date" name="hasta" required /></label>
      <button className="boton" type="submit">Generar cupos</button>
    </form>
  )
}
