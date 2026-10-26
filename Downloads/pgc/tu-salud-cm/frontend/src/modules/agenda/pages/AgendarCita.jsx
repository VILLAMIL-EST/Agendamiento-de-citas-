import { useEffect, useMemo, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { useAuth } from '../../../hooks/useAuth'
import { mensajeError } from '../../../services/api'
import { listarMenores } from '../../login/services/authService'
import SelectorCupo from '../components/SelectorCupo'
import { useLease } from '../hooks/useLease'
import {
  bloquearCupo,
  confirmarCupo,
  consultarDisponibilidad,
  liberarCupo,
  listarFechasDisponibles,
  listarMedicos,
} from '../services/agendaService'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function formatearFecha(fecha) {
  if (!fecha) return ''
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function etiquetaFecha(fecha) {
  const dia = new Date(`${fecha}T00:00:00`).getDay()
  return `${DIAS[dia]} ${formatearFecha(fecha)}`
}

export default function AgendarCita() {
  const { usuario } = useAuth()
  const [medicos, setMedicos] = useState([])
  const [menores, setMenores] = useState([])
  const [paso, setPaso] = useState(1)
  const [especialidad, setEspecialidad] = useState('')
  const [medico, setMedico] = useState('')
  const [fecha, setFecha] = useState('')
  const [fechas, setFechas] = useState([])
  const [cargandoFechas, setCargandoFechas] = useState(false)
  const [cupos, setCupos] = useState([])
  const [cargandoCupos, setCargandoCupos] = useState(false)
  const [arrendado, setArrendado] = useState(null)
  const [pacienteId, setPacienteId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const { restante, texto } = useLease(arrendado?.lease_expires_at)

  const especialidades = useMemo(() => (
    [...new Set(medicos.map((item) => item.especialidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  ), [medicos])
  const medicosFiltrados = useMemo(
    () => medicos.filter((item) => item.especialidad === especialidad),
    [medicos, especialidad],
  )
  const medicoElegido = medicos.find((item) => String(item.id) === String(medico))

  useEffect(() => {
    listarMedicos().then(({ data }) => setMedicos(data)).catch((err) => setError(mensajeError(err)))
    listarMenores().then(({ data }) => setMenores(data)).catch(() => setMenores([]))
  }, [])

  async function buscarCupos() {
    if (!medico || !fecha) return
    setError('')
    setCargandoCupos(true)
    try {
      const { data } = await consultarDisponibilidad(medico, fecha)
      setCupos(data.cupos)
      const propio = data.cupos.find((cupo) => cupo.propio)
      if (propio) setArrendado(propio)
    } catch (err) {
      setError(mensajeError(err))
      setCupos([])
    } finally {
      setCargandoCupos(false)
    }
  }

  useEffect(() => {
    if (paso === 4 && medico && fecha) {
      buscarCupos()
      return
    }
    setCupos([])
  }, [paso, medico, fecha])

  useEffect(() => {
    if (!medico || paso < 3) {
      setFechas([])
      return undefined
    }
    setCargandoFechas(true)
    listarFechasDisponibles(medico)
      .then(({ data }) => setFechas(data.fechas || []))
      .catch((err) => {
        setError(mensajeError(err))
        setFechas([])
      })
      .finally(() => setCargandoFechas(false))
    return undefined
  }, [medico, paso])

  function elegirEspecialidad(valor) {
    if (!valor) return
    setEspecialidad(valor)
    setMotivo(`Consulta de ${valor.toLowerCase()}`)
    setAviso('')
    setError('')
    setPaso(2)
  }

  function elegirMedico(valor) {
    if (!valor) return
    setMedico(valor)
    setAviso('')
    setError('')
    setPaso(3)
  }

  function elegirFecha(dia) {
    setFecha(dia)
    setAviso('')
    setError('')
    setPaso(4)
  }

  async function liberarSiHayCupo() {
    if (!arrendado) return
    try {
      await liberarCupo(arrendado.id)
    } catch {
      // Si el arrendamiento ya venció, el cupo vuelve solo a la oferta.
    }
    setArrendado(null)
  }

  async function atras() {
    setError('')
    setAviso('')
    if (paso === 4) {
      await liberarSiHayCupo()
      setFecha('')
      setCupos([])
      setPaso(3)
      return
    }
    if (paso === 3) {
      setMedico('')
      setFecha('')
      setFechas([])
      setPaso(2)
      return
    }
    if (paso === 2) {
      setEspecialidad('')
      setMedico('')
      setMotivo('')
      setPaso(1)
    }
  }

  async function bloquear(cupo) {
    setError('')
    setAviso('')
    try {
      const { data } = await bloquearCupo(cupo.id)
      setArrendado(data)
    } catch (err) {
      setError(mensajeError(err))
      buscarCupos()
    }
  }

  async function confirmar(evento) {
    evento.preventDefault()
    setError('')
    try {
      await confirmarCupo(arrendado.id, {
        paciente_id: pacienteId || null,
        motivo,
      })
      setArrendado(null)
      setAviso('La cita quedó confirmada.')
      buscarCupos()
      listarFechasDisponibles(medico).then(({ data }) => setFechas(data.fechas || []))
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  useEffect(() => {
    if (!arrendado?.lease_expires_at) return undefined
    const vence = new Date(arrendado.lease_expires_at).getTime()
    const id = window.setInterval(() => {
      if (Date.now() >= vence) {
        setArrendado(null)
        setError('El tiempo para confirmar se agotó. El cupo quedó libre.')
        if (medico && fecha) buscarCupos()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [arrendado?.id])

  return (
    <section>
      <p className="sobrelinea">Canal web</p>
      <h1>Agendar cita</h1>
      <p className="lead">
        Avance paso a paso. Lo anterior queda bloqueado; use Atrás si necesita cambiarlo.
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>

      <div className="pasos-agendar">
        <article className={`tarjeta panel-paso${paso > 1 ? ' panel-bloqueado' : ''}`}>
          <p className="sobrelinea">Paso 1</p>
          <h2>Especialidad</h2>
          {paso === 1 ? (
            <label>
              Seleccione la especialidad
              <select value={especialidad} onChange={(e) => elegirEspecialidad(e.target.value)} required>
                <option value="">Seleccione</option>
                {especialidades.map((nombre) => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
              </select>
            </label>
          ) : (
            <p>{especialidad}</p>
          )}
        </article>

        {paso >= 2 && (
          <article className={`tarjeta panel-paso${paso > 2 ? ' panel-bloqueado' : ''}`}>
            <p className="sobrelinea">Paso 2</p>
            <h2>Médico</h2>
            {paso === 2 ? (
              <>
                <label>
                  Seleccione el profesional
                  <select value={medico} onChange={(e) => elegirMedico(e.target.value)} required>
                    <option value="">Seleccione</option>
                    {medicosFiltrados.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombres} {item.apellidos}
                      </option>
                    ))}
                  </select>
                </label>
                {medicosFiltrados.length === 0 && (
                  <p className="nota">No hay médicos habilitados en esa especialidad.</p>
                )}
                <button type="button" className="boton boton-suave" onClick={atras}>Atrás</button>
              </>
            ) : (
              <p>{medicoElegido ? `${medicoElegido.nombres} ${medicoElegido.apellidos}` : ''}</p>
            )}
          </article>
        )}

        {paso >= 3 && (
          <article className={`tarjeta panel-paso panel-fechas${paso > 3 ? ' panel-bloqueado' : ''}`}>
            <p className="sobrelinea">Paso 3</p>
            <h2>Fecha</h2>
            {paso === 3 ? (
              <>
                <p className="nota">Solo se muestran los días con cupos libres.</p>
                {cargandoFechas && <p className="nota">Buscando días disponibles…</p>}
                <div className="cupos">
                  {fechas.map((dia) => (
                    <button
                      key={dia}
                      type="button"
                      className="cupo"
                      onClick={() => elegirFecha(dia)}
                    >
                      {etiquetaFecha(dia)}
                    </button>
                  ))}
                </div>
                {!cargandoFechas && fechas.length === 0 && (
                  <p>Este médico no tiene cupos abiertos. Use Atrás y pruebe otro profesional.</p>
                )}
                <button type="button" className="boton boton-suave" onClick={atras}>Atrás</button>
              </>
            ) : (
              <p>{etiquetaFecha(fecha)}</p>
            )}
          </article>
        )}
      </div>

      {paso === 4 && (
        <article className="tarjeta panel-grafica tablero-agenda">
          <p className="sobrelinea">Paso 4</p>
          <h2>Cupos disponibles</h2>
          <p className="nota">
            {especialidad}
            {medicoElegido ? ` · ${medicoElegido.nombres} ${medicoElegido.apellidos}` : ''}
            {` · ${formatearFecha(fecha)}`}
          </p>
          {cargandoCupos && <p className="nota">Consultando la oferta…</p>}
          {!arrendado && <SelectorCupo cupos={cupos} onElegir={bloquear} />}
          {!cargandoCupos && !arrendado && cupos.filter((cupo) => !cupo.propio).length === 0 && (
            <p>No hay cupos libres en esa fecha. Use Atrás y elija otro día.</p>
          )}
          <button type="button" className="boton boton-suave" onClick={atras}>Atrás</button>
        </article>
      )}

      {paso === 4 && arrendado && restante > 0 && (
        <form className="tarjeta" onSubmit={confirmar}>
          <h2>Cupo reservado · {texto}</h2>
          <p>Confirme antes de que el contador llegue a cero. Si pulsa Atrás, el cupo se libera.</p>
          {menores.length === 0 ? (
            <p className="paciente-atender">
              Paciente a atender: {usuario?.nombres} {usuario?.apellidos}
            </p>
          ) : (
            <label>
              Paciente a atender
              <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                <option value="">{usuario?.nombres} {usuario?.apellidos}</option>
                {menores.map((menor) => (
                  <option key={menor.id} value={menor.id}>
                    Para {menor.nombres} {menor.apellidos}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Motivo
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={180} />
          </label>
          <div className="fila">
            <button className="boton" type="submit">Confirmar cita</button>
            <button className="boton boton-suave" type="button" onClick={atras}>Atrás</button>
          </div>
        </form>
      )}
    </section>
  )
}
