import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { crearSolicitudTutela, listarMenores, listarSolicitudesTutela } from '../services/authService'

const INICIAL = {
  nombres: '',
  apellidos: '',
  tipo_documento: 'TI',
  numero_documento: '',
  fecha_nacimiento: '',
}

const ETIQUETAS = {
  pendiente: 'Pendiente de validación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
}

const CLASES = {
  pendiente: 'pendiente',
  aprobada: 'activo',
  rechazada: 'rechazado',
}

export default function Menores() {
  const [menores, setMenores] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [datos, setDatos] = useState(INICIAL)
  const [soporte, setSoporte] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  function cargar() {
    listarMenores().then(({ data }) => setMenores(data)).catch((err) => setError(mensajeError(err)))
    listarSolicitudesTutela()
      .then(({ data }) => setSolicitudes(data))
      .catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => { cargar() }, [])

  function cambiar(evento) {
    setDatos((previo) => ({ ...previo, [evento.target.name]: evento.target.value }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    if (!soporte) {
      setError('Adjunte una foto (Tutor y del menor), o un PDF ')
      return
    }
    const formulario = new FormData()
    Object.entries(datos).forEach(([clave, valor]) => formulario.append(clave, valor))
    formulario.append('soporte', soporte)
    setOcupado(true)
    try {
      await crearSolicitudTutela(formulario)
      setDatos(INICIAL)
      setSoporte(null)
      evento.target.reset()
      setAviso('La solicitud quedó en revisión del administrador por favor espere una respuesta de la administración.')
      cargar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section>
      <p className="sobrelinea">Tutores</p>
      <h1>Menores a cargo</h1>
      <p className="lead">
        Puede registrar al menor, pero no queda creado del todo. Administración debe validar
        la tarjeta de identidad o el registro civil. Mientras esté pendiente no se puede
        agendar ni consultar resultados a su nombre.
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario grilla-form" onSubmit={enviar}>
        <label>Nombres<input name="nombres" value={datos.nombres} onChange={cambiar} required /></label>
        <label>Apellidos<input name="apellidos" value={datos.apellidos} onChange={cambiar} required /></label>
        <label>
          Documento
          <select name="tipo_documento" value={datos.tipo_documento} onChange={cambiar}>
            <option value="TI">Tarjeta de identidad</option>
            <option value="RC">Registro civil</option>
          </select>
        </label>
        <label>Número<input name="numero_documento" value={datos.numero_documento} onChange={cambiar} required /></label>
        <label>Nacimiento<input type="date" name="fecha_nacimiento" value={datos.fecha_nacimiento} onChange={cambiar} required /></label>
        <label>
          Foto o PDF del documento
          <input
            type="file"
            name="soporte"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            onChange={(evento) => setSoporte(evento.target.files?.[0] || null)}
            required
          />
        </label>
        <button className="boton" type="submit" disabled={ocupado}>
          {ocupado ? 'Enviando…' : 'Enviar a validación'}
        </button>
      </form>

      <h2 className="titulo-lista">Solicitudes enviadas</h2>
      <div className="lista">
        {solicitudes.map((item) => (
          <article key={item.id} className="tarjeta">
            <h2>{item.nombres} {item.apellidos}</h2>
            <p>{item.tipo_documento} {item.numero_documento}</p>
            <p>Nacimiento: {item.fecha_nacimiento}</p>
            {item.motivo_rechazo && <p>Motivo: {item.motivo_rechazo}</p>}
            <span className={`estado estado-${CLASES[item.estado] || item.clasificacion}`}>
              {ETIQUETAS[item.estado] || item.estado}
            </span>
          </article>
        ))}
        {solicitudes.length === 0 && <p>Aún no ha enviado solicitudes de tutela.</p>}
      </div>

      <h2 className="titulo-lista">Menores validados</h2>
      <div className="lista">
        {menores.map((menor) => (
          <article key={menor.id} className="tarjeta">
            <h2>{menor.nombres} {menor.apellidos}</h2>
            <p>{menor.tipo_documento} {menor.numero_documento}</p>
            <span className="estado estado-activo">Listo para citas y resultados</span>
          </article>
        ))}
        {menores.length === 0 && <p>Ningún menor ha sido aprobado todavía.</p>}
      </div>
    </section>
  )
}
