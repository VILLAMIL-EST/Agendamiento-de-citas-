export default function RegistroMedicoForm({ onSubmit }) {
  return (
    <form className="formulario tarjeta apartado-panel" onSubmit={onSubmit}>
      <h2>Registrar médico</h2>
      <p className="nota">Crea la cuenta del profesional. Después podrá asignarle jornadas con fecha.</p>
      <label>Nombres<input name="nombres" required /></label>
      <label>Apellidos<input name="apellidos" required /></label>
      <label>Correo<input type="email" name="email" required /></label>
      <label>Contraseña temporal<input type="password" name="password" required /></label>
      <label>Documento<input name="numero_documento" required /></label>
      <label>Registro médico<input name="registro_medico" required /></label>
      <label>Especialidad<input name="especialidad" defaultValue="Medicina general" /></label>
      <button className="boton" type="submit">Crear</button>
    </form>
  )
}
