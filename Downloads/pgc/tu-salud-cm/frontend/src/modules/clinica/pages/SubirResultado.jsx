import { useEffect, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { listarPacientesDelMedico, subirResultado } from '../services/clinicaService'

export default function SubirResultado() {
  const [pacientes, setPacientes] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    listarPacientesDelMedico()
      .then(({ data }) => setPacientes(data))
      .catch((err) => setError(mensajeError(err)))
  }, [])

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setAviso('')
    const formulario = new FormData(evento.target)
    setOcupado(true)
    try {
      await subirResultado(formulario)
      setAviso('El PDF se cifró con el documento del paciente y quedó asociado a su historia.')
      evento.target.reset()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section>
      <p className="sobrelinea">Documentos clínicos</p>
      <h1>Cargar resultado</h1>
      <p className="lead">Suba el PDF original. El servidor lo cifra antes de almacenarlo.</p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>
      <form className="formulario" onSubmit={enviar}>
        <label>
          Paciente
          <select name="paciente_id" required>
            <option value="">Seleccione</option>
            {pacientes.map((paciente) => (
              <option key={paciente.id} value={paciente.id}>{paciente.nombre}</option>
            ))}
          </select>
        </label>
        <label>Título<input name="titulo" required maxLength={160} /></label>
        <label>
          Tipo
          <select name="tipo" defaultValue="reporte">
            <option value="reporte">Reporte clínico</option>
            <option value="laboratorio">Laboratorio</option>
            <option value="formula">Fórmula médica</option>
          </select>
        </label>
        <label>Fecha del resultado<input type="date" name="fecha_resultado" required /></label>
        <label>PDF<input type="file" name="archivo" accept="application/pdf" required /></label>
        <button className="boton" type="submit" disabled={ocupado}>
          {ocupado ? 'Cifrando…' : 'Guardar resultado'}
        </button>
      </form>
    </section>
  )
}
