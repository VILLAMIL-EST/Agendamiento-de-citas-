export default function FormularioCredenciales({
  identificador,
  password,
  ocupado,
  onIdentificador,
  onPassword,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="formulario">
      <label>
        Correo o cédula
        <input
          type="text"
          value={identificador}
          onChange={onIdentificador}
          required
          autoComplete="username"
          inputMode="email"
        />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={onPassword} required autoComplete="current-password" />
      </label>
      <button className="boton" type="submit" disabled={ocupado}>
        {ocupado ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
