import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { verificarCorreo } from '../services/authService'

export default function VerificarEmail() {
  const { token } = useParams()
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    verificarCorreo(token)
      .then(({ data }) => {
        if (activo) setAviso(data.detail)
      })
      .catch((err) => {
        if (activo) setError(mensajeError(err))
      })
    return () => {
      activo = false
    }
  }, [token])

  return (
    <div className="acceso">
      <section className="acceso-panel">
        <p className="sobrelinea">Confirmación de correo</p>
        <h1>Tu Salud CM</h1>
        {!aviso && !error && <p>Confirmando el enlace…</p>}
        <Alerta tipo="ok">{aviso}</Alerta>
        <Alerta>{error}</Alerta>
        <p className="pie-form"><Link to="/login">Ir al ingreso</Link></p>
      </section>
    </div>
  )
}
