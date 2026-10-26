import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { useAuth } from '../../../hooks/useAuth'
import { mensajeError } from '../../../services/api'

const INICIAL = {
  nombres: '',
  apellidos: '',
  email: '',
  password: '',
  telefono: '',
  tipo_documento: 'CC',
  numero_documento: '',
  fecha_nacimiento: '',
  consentimiento_datos: false,
}

export default function Registro() {
  const { usuario, registrar } = useAuth()
  const [datos, setDatos] = useState(INICIAL)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enlace, setEnlace] = useState('')
  const [ocupado, setOcupado] = useState(false)

  if (usuario) return <Navigate to="/" replace />

  function cambiar(evento) {
    const { name, value, type, checked } = evento.target
    setDatos((previo) => ({ ...previo, [name]: type === 'checkbox' ? checked : value }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    setOcupado(true)
    try {
      const data = await registrar(datos)
      setAviso(data.detail)
      setEnlace(data.enlace_debug || '')
      setDatos(INICIAL)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="acceso">
      <section className="acceso-panel acceso-ancho">
        <p className="sobrelinea">Registro de paciente</p>
        <h1>Crear cuenta</h1>
        <p className="lead">La cuenta es para un adulto. Los menores se solicitan después y un administrador valida el documento.</p>
        <Alerta>{error}</Alerta>
        <Alerta tipo="ok">{aviso}</Alerta>
        {enlace && (
          <p className="nota">
            Prototipo local, el correo también aparece en la consola del servidor.{' '}
            <a href={enlace}>Confirmar correo</a>
          </p>
        )}
        <form onSubmit={enviar} className="formulario grilla-form">
          <label>Nombres<input name="nombres" value={datos.nombres} onChange={cambiar} required /></label>
          <label>Apellidos<input name="apellidos" value={datos.apellidos} onChange={cambiar} required /></label>
          <label>Correo<input type="email" name="email" value={datos.email} onChange={cambiar} required /></label>
          <label>Contraseña<input type="password" name="password" value={datos.password} onChange={cambiar} required /></label>
          <label>Teléfono<input name="telefono" value={datos.telefono} onChange={cambiar} /></label>
          <label>
            Documento
            <select name="tipo_documento" value={datos.tipo_documento} onChange={cambiar}>
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
            </select>
          </label>
          <label>Número<input name="numero_documento" value={datos.numero_documento} onChange={cambiar} required /></label>
          <label>Fecha de nacimiento<input type="date" name="fecha_nacimiento" value={datos.fecha_nacimiento} onChange={cambiar} required /></label>
          <label className="check">
            <input type="checkbox" name="consentimiento_datos" checked={datos.consentimiento_datos} onChange={cambiar} />
            Autorizo el tratamiento de mis datos personales y de salud, conforme a la Ley 1581 de 2012.
          </label>
          <button className="boton" type="submit" disabled={ocupado}>Crear cuenta</button>
        </form>
        <p className="pie-form"><Link to="/login">Ya tengo cuenta</Link></p>
      </section>
    </div>
  )
}
