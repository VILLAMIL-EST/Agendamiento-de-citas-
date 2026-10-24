import { useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { crearMedico } from '../services/adminService'

export default function RegistroMedico() {
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function altaMedico(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    const payload = Object.fromEntries(new FormData(evento.target).entries())
    try {
      await crearMedico(payload)
      evento.target.reset()
      setAviso('El profesional quedó habilitado en el canal web.')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Profesionales</p>
      <h1>Registro de médico</h1>
      <p className="lead">
        Cree la cuenta del profesional. Después asígnele jornadas con fecha concreta
        y abra los cupos de esa semana.
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario tarjeta" onSubmit={altaMedico} style={{ maxWidth: 520 }}>
        <label>Nombres<input name="nombres" required /></label>
        <label>Apellidos<input name="apellidos" required /></label>
        <label>Correo<input type="email" name="email" required /></label>
        <label>Contraseña temporal<input type="password" name="password" required /></label>
        <label>Documento<input name="numero_documento" required /></label>
        <label>Registro médico<input name="registro_medico" required /></label>
        <label>Especialidad<input name="especialidad" defaultValue="Medicina general" /></label>
        <button className="boton" type="submit">Crear médico</button>
      </form>
    </section>
  )
}
