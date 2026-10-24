import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { useAuth } from '../../../hooks/useAuth'
import { mensajeError } from '../../../services/api'
import FormularioCredenciales from '../components/FormularioCredenciales'
import { recuperarClave } from '../services/authService'

export default function Login() {
  const { usuario, entrar, verificar2fa } = useAuth()
  const destino = useLocation().state?.desde || '/'
  const [identificador, setIdentificador] = useState('')
  const [password, setPassword] = useState('')
  const [preAuth, setPreAuth] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recuperar, setRecuperar] = useState(false)
  const [aviso, setAviso] = useState('')

  if (usuario) return <Navigate to={destino} replace />

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setOcupado(true)
    try {
      const data = await entrar(identificador, password)
      if (data.requires_2fa) setPreAuth(data.pre_auth)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarCodigo(evento) {
    evento.preventDefault()
    setError('')
    setOcupado(true)
    try {
      await verificar2fa(preAuth, codigo)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function pedirRecuperacion(evento) {
    evento.preventDefault()
    setAviso('')
    setError('')
    try {
      const { data } = await recuperarClave(identificador)
      setAviso(
        data.token_debug
          ? `Prototipo local. Token temporal: ${data.token_debug}`
          : data.detail,
      )
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <div className="acceso">
      <section className="acceso-panel">
        <p className="sobrelinea">E.S.E. Hospital El Salvador de Ubaté</p>
        <h1>Tu Salud CM</h1>
        <p className="lead">Ingrese con el correo o la cédula, y la contraseña de su cuenta.</p>
        <Alerta>{error}</Alerta>
        {!preAuth ? (
          <FormularioCredenciales
            identificador={identificador}
            password={password}
            ocupado={ocupado}
            onIdentificador={(e) => setIdentificador(e.target.value)}
            onPassword={(e) => setPassword(e.target.value)}
            onSubmit={enviar}
          />
        ) : (
          <form onSubmit={confirmarCodigo} className="formulario">
            <p>Escriba el código de seis dígitos de su aplicación de autenticación.</p>
            <label>
              Código
              <input inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            </label>
            <button className="boton" type="submit" disabled={ocupado}>Verificar</button>
          </form>
        )}
        <p className="pie-form">
          <button type="button" className="enlace" onClick={() => setRecuperar((v) => !v)}>
            Olvidé mi contraseña
          </button>
          <Link to="/registro">Crear cuenta de paciente</Link>
        </p>
        {recuperar && (
          <form onSubmit={pedirRecuperacion} className="formulario formulario-secundario">
            <Alerta tipo="ok">{aviso}</Alerta>
            <button className="boton boton-suave" type="submit">Generar enlace temporal</button>
          </form>
        )}
      </section>
    </div>
  )
}
