import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { decidirSolicitud } from '../services/adminService'

export default function DecidirSolicitud() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function decidir(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    setOcupado(true)
    try {
      const { data } = await decidirSolicitud(token, motivo)
      setAviso(data.detail)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section>
      <p className="sobrelinea">Enlace firmado</p>
      <h1>Resolver solicitud</h1>
      <p className="lead">Este enlace solo se acepta porque ya inició sesión como administración.</p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario" onSubmit={decidir}>
        <label>
          Motivo, solo si va a rechazar
          <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
        </label>
        <button className="boton" type="submit" disabled={ocupado || !token}>Confirmar decisión del enlace</button>
      </form>
    </section>
  )
}
