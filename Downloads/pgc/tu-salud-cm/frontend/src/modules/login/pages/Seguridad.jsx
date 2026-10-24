import { useState } from 'react'
import Alerta from '../../../components/Alerta'
import { useAuth } from '../../../hooks/useAuth'
import { mensajeError } from '../../../services/api'
import { activarSegundoFactor, confirmarSegundoFactor } from '../services/authService'

export default function Seguridad() {
  const { usuario } = useAuth()
  const [qr, setQr] = useState('')
  const [codigo, setCodigo] = useState('')
  const [activo, setActivo] = useState(usuario.otp_enabled)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function generar() {
    setError('')
    try {
      const { data } = await activarSegundoFactor()
      if (data.qr_base64) setQr(data.qr_base64)
      else setAviso(data.detail)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function confirmar(evento) {
    evento.preventDefault()
    setError('')
    try {
      await confirmarSegundoFactor(codigo)
      setActivo(true)
      setAviso('La verificación en dos pasos quedó activa. El próximo ingreso pedirá el código.')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Segundo factor</p>
      <h1>Seguridad de la cuenta</h1>
      <p className="lead">
        La sesión de acceso dura 30 minutos. El token de renovación permanece en una cookie HttpOnly
        y el token de acceso solo vive en la memoria de esta pestaña.
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      {activo ? (
        <p>La autenticación en dos pasos está activa.</p>
      ) : (
        <div className="tarjeta">
          <button type="button" className="boton" onClick={generar}>Generar código QR</button>
          {qr && (
            <form onSubmit={confirmar} className="formulario">
              <img alt="Código QR para configurar el segundo factor" src={`data:image/png;base64,${qr}`} />
              <label>
                Código de la aplicación
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
              </label>
              <button className="boton" type="submit">Activar</button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
