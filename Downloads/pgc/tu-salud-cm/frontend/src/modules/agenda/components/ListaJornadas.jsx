import { useEffect, useMemo, useRef, useState } from 'react'
import { mensajeError } from '../../../services/api'
import { descargarResultado, listarResultadosDeCita } from '../../clinica/services/clinicaService'
import { listarCitasHorario } from '../services/agendaService'
import { formatearFecha as formatearFechaLarga } from '../utils/fechas'

const GRUPOS = [
  ['propuesta', 'Propuestas', 'Asignadas, todavía sin cupos publicados.'],
  ['activa', 'Activas', 'Ya tienen cupos abiertos y la fecha no ha pasado.'],
  ['vencida', 'Vencidas', 'La fecha de la jornada ya pasó.'],
]

const ETIQUETAS = {
  propuesta: 'Propuesta',
  activa: 'Activa',
  vencida: 'Vencida',
}

const ETIQUETAS_CITA = {
  disponible: 'Libre',
  sin_publicar: 'Sin publicar',
  no_abierto: 'No abierto',
  bloqueado: 'En reserva',
  confirmado: 'Tomada',
  atendido: 'Asistió',
  no_asistio: 'No asistió',
  inconsistencia: 'Inconsistencia',
}

const DOCUMENTOS = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  RC: 'Registro civil',
  CE: 'Cédula de extranjería',
}

const TIPOS_PDF = {
  reporte: 'Reporte clínico',
  laboratorio: 'Laboratorio',
  formula: 'Fórmula médica',
}

const TEXTOS_CITA = {
  disponible: 'Este cupo está libre. Nadie lo ha tomado.',
  sin_publicar: 'Esta franja pertenece a la jornada, pero los cupos todavía no se han publicado.',
  no_abierto: 'Este horario ya había pasado cuando se abrieron los cupos, así que no quedó disponible.',
  bloqueado: 'Hay una reserva temporal. La cita todavía no está confirmada.',
  confirmado: 'La cita fue tomada. El médico todavía puede registrar la asistencia.',
  atendido: 'La cita fue tomada y el médico registró que el paciente asistió.',
  no_asistio: 'La cita fue tomada y el médico registró que el paciente no asistió.',
  inconsistencia: 'La cita fue tomada y el médico no registró la asistencia dentro del plazo.',
}

function formatearFecha(fecha) {
  if (!fecha) return ''
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function coincideDocumento(valor, busqueda) {
  const limpio = String(busqueda || '').replace(/\D/g, '')
  if (!limpio) return true
  return String(valor || '').replace(/\D/g, '').includes(limpio)
}

function compararJornadas(a, b, direccion) {
  const signo = direccion === 'desc' ? -1 : 1
  const porFecha = String(a.fecha).localeCompare(String(b.fecha))
  if (porFecha !== 0) return porFecha * signo
  return String(a.hora_inicio).localeCompare(String(b.hora_inicio))
}

function horaDe(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function agruparPorFecha(lista) {
  const grupos = []
  lista.forEach((horario) => {
    const ultimo = grupos[grupos.length - 1]
    if (!ultimo || ultimo.fecha !== horario.fecha) {
      grupos.push({
        fecha: horario.fecha,
        dia: horario.dia_nombre,
        items: [horario],
      })
      return
    }
    ultimo.items.push(horario)
  })
  return grupos
}

function ApartadoCita({ jornada, cupo, soportes, cargandoArchivos, onVolver, onDescargar }) {
  const paciente = cupo.paciente
  const medicoAtendio = cupo.estado === 'atendido'
  return (
    <div className="tablero-dia">
      <div className="fila-espacio">
        <button type="button" className="boton boton-suave" onClick={onVolver}>Volver a las citas</button>
        <h2>{horaDe(cupo.inicio)} a {horaDe(cupo.fin)}</h2>
        <span />
      </div>
      <p className="nota">{TEXTOS_CITA[cupo.estado]}</p>

      <article className="tarjeta">
        <p className="sobrelinea">Paciente</p>
        {paciente ? (
          <>
            <h2>{paciente.nombres} {paciente.apellidos}</h2>
            <p>{DOCUMENTOS[paciente.tipo_documento] || paciente.tipo_documento} {paciente.numero_documento}</p>
            {paciente.fecha_nacimiento && <p>Nacimiento: {formatearFechaLarga(paciente.fecha_nacimiento)}</p>}
            {paciente.telefono && <p>Teléfono: {paciente.telefono}</p>}
            {paciente.email && <p>Correo: {paciente.email}</p>}
            {paciente.tutor_nombre && <p>Tutor: {paciente.tutor_nombre}</p>}
            {cupo.solicitante_nombre && <p>Quien agendó: {cupo.solicitante_nombre}</p>}
          </>
        ) : (
          <h2>Sin paciente</h2>
        )}
        <span className={`estado estado-${cupo.estado}`}>{ETIQUETAS_CITA[cupo.estado] || cupo.estado}</span>
      </article>

      <article className="tarjeta">
        <p className="sobrelinea">Motivo de la cita</p>
        <h2>{cupo.motivo || 'Sin motivo registrado'}</h2>
      </article>

      <article className="tarjeta">
        <p className="sobrelinea">{medicoAtendio ? 'Médico que atendió' : 'Médico asignado'}</p>
        <h2>{jornada.medico_nombre}</h2>
        <p>Documento {jornada.medico_documento || 'sin cédula'}</p>
      </article>

      <article className="tarjeta">
        <p className="sobrelinea">Archivos adjuntos</p>
        <h2>Documentos de la cita</h2>
        {cargandoArchivos && <p>Cargando documentos…</p>}
        {!cargandoArchivos && soportes.length === 0 && (
          <p className="nota">No se cargaron documentos en esta cita.</p>
        )}
        {soportes.map((item) => (
          <div key={item.id} className="soporte-pdf">
            <div>
              <strong>{item.titulo}</strong>
              <p>{TIPOS_PDF[item.tipo] || item.tipo} · {item.medico_nombre}</p>
            </div>
            <button type="button" className="boton boton-suave" onClick={() => onDescargar(item.id, item.titulo)}>
              Ver soporte
            </button>
          </div>
        ))}
        {soportes.length > 0 && paciente && (
          <p className="nota">El PDF está cifrado. La contraseña es el documento del paciente.</p>
        )}
      </article>
    </div>
  )
}

export default function ListaJornadas({ horarios, filtro, documento, onFiltro, onDocumento, onEliminar, onVista }) {
  const [orden, setOrden] = useState('asc')
  const [vista, setVista] = useState('lista')
  const [jornada, setJornada] = useState(null)
  const [cupos, setCupos] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cupoActivo, setCupoActivo] = useState('')
  const [soportes, setSoportes] = useState([])
  const [cargandoCupos, setCargandoCupos] = useState(false)
  const [cargandoArchivos, setCargandoArchivos] = useState(false)
  const [errorCupos, setErrorCupos] = useState('')
  const solicitud = useRef(0)
  const porDocumento = horarios.filter((horario) => coincideDocumento(horario.medico_documento, documento))
  const visibles = useMemo(() => {
    const filtradas = filtro === 'todas'
      ? porDocumento
      : porDocumento.filter((horario) => horario.clasificacion === filtro)
    return [...filtradas].sort((a, b) => compararJornadas(a, b, orden))
  }, [porDocumento, filtro, orden])
  const porFecha = agruparPorFecha(visibles)
  const detalle = cupos.find((cupo) => cupo.inicio === cupoActivo)

  useEffect(() => {
    onVista?.(vista)
    if (vista === 'lista') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [vista, cupoActivo, onVista])

  useEffect(() => {
    if (vista !== 'detalle' || !detalle?.id) {
      setSoportes([])
      setCargandoArchivos(false)
      return undefined
    }
    let vigente = true
    setCargandoArchivos(true)
    listarResultadosDeCita(detalle.id)
      .then(({ data }) => {
        if (vigente) setSoportes(data)
      })
      .catch((err) => {
        if (vigente) setErrorCupos(mensajeError(err))
      })
      .finally(() => {
        if (vigente) setCargandoArchivos(false)
      })
    return () => {
      vigente = false
    }
  }, [vista, detalle?.id])

  async function verCitas(horario) {
    setErrorCupos('')
    const actual = solicitud.current + 1
    solicitud.current = actual
    setJornada(horario)
    setVista('citas')
    setCupoActivo('')
    setCupos([])
    setResumen(null)
    setCargandoCupos(true)
    try {
      const { data } = await listarCitasHorario(horario.id)
      if (solicitud.current !== actual) return
      setCupos(data.citas)
      setResumen(data.resumen)
    } catch (err) {
      if (solicitud.current !== actual) return
      setErrorCupos(mensajeError(err))
    } finally {
      if (solicitud.current === actual) setCargandoCupos(false)
    }
  }

  async function descargarSoporte(id, titulo) {
    setErrorCupos('')
    try {
      const respuesta = await descargarResultado(id)
      const url = URL.createObjectURL(respuesta.data)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `${titulo || 'resultado'}.pdf`
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorCupos(mensajeError(err))
    }
  }

  if (vista === 'detalle' && jornada && detalle) {
    return (
      <div>
        {errorCupos && <p className="alerta alerta-error">{errorCupos}</p>}
        <ApartadoCita
          jornada={jornada}
          cupo={detalle}
          soportes={soportes}
          cargandoArchivos={cargandoArchivos}
          onVolver={() => {
            setErrorCupos('')
            setVista('citas')
          }}
          onDescargar={descargarSoporte}
        />
      </div>
    )
  }

  if (vista === 'citas' && jornada) {
    return (
      <div className="tablero-dia">
        <div className="fila-espacio">
          <button
            type="button"
            className="boton boton-suave"
            onClick={() => {
              setErrorCupos('')
              setVista('lista')
            }}
          >
            Volver a la lista
          </button>
          <h2>Citas de la jornada</h2>
          <span />
        </div>
        <article className="tarjeta">
          <p className="sobrelinea">{jornada.dia_nombre} {formatearFecha(jornada.fecha)}</p>
          <h2>{jornada.medico_nombre}</h2>
          <p>
            {jornada.hora_inicio.slice(0, 5)} a {jornada.hora_fin.slice(0, 5)}
            {' · '}
            {jornada.duracion_minutos} min
          </p>
          {resumen && (
            <p className="nota">
              {resumen.total} {resumen.total === 1 ? 'cita' : 'citas'}
              {' · '}
              {resumen.tomadas} {resumen.tomadas === 1 ? 'tomada' : 'tomadas'}
              {' · '}
              {resumen.libres} {resumen.libres === 1 ? 'libre' : 'libres'}
            </p>
          )}
        </article>
        {errorCupos && <p className="alerta alerta-error">{errorCupos}</p>}
        {cargandoCupos && <p>Cargando citas…</p>}
        {cupos.map((cupo) => (
          <button
            key={cupo.inicio}
            type="button"
            className="tarjeta cita-dia"
            onClick={() => {
              setErrorCupos('')
              setCupoActivo(cupo.inicio)
              setVista('detalle')
            }}
          >
            <div className="fila-espacio">
              <h2>{horaDe(cupo.inicio)} a {horaDe(cupo.fin)}</h2>
              <span className={`estado estado-${cupo.estado}`}>
                {ETIQUETAS_CITA[cupo.estado] || cupo.estado}
              </span>
            </div>
            <p>{cupo.paciente ? `${cupo.paciente.nombres} ${cupo.paciente.apellidos}` : 'Sin paciente'}</p>
          </button>
        ))}
        {!cargandoCupos && cupos.length === 0 && !errorCupos && (
          <p>Esta jornada no tiene franjas de cita.</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="nota">
        Elija Ver citas para abrir la jornada. Ahí puede entrar a cada horario, por ejemplo de 7:00 a 7:20, y consultar el paciente, el motivo, el médico y los archivos.
      </p>
      <div className="fila filtros-jornada">
        <label className="filtro-documento">
          Filtrar por documento del médico
          <input
            type="text"
            inputMode="numeric"
            value={documento}
            onChange={(evento) => onDocumento(evento.target.value)}
            placeholder="Escriba la cédula"
          />
        </label>
        <div>
          <p className="nota">Ordenar por fecha</p>
          <div className="subapartados">
            <button
              type="button"
              className={orden === 'asc' ? 'boton' : 'boton boton-suave'}
              onClick={() => setOrden('asc')}
            >
              Ascendente
            </button>
            <button
              type="button"
              className={orden === 'desc' ? 'boton' : 'boton boton-suave'}
              onClick={() => setOrden('desc')}
            >
              Descendente
            </button>
          </div>
        </div>
      </div>
      <div className="subapartados">
        <button type="button" className={filtro === 'todas' ? 'boton' : 'boton boton-suave'} onClick={() => onFiltro('todas')}>
          Todas ({porDocumento.length})
        </button>
        {GRUPOS.map(([clave, titulo]) => (
          <button
            key={clave}
            type="button"
            className={filtro === clave ? 'boton' : 'boton boton-suave'}
            onClick={() => onFiltro(clave)}
          >
            {titulo} ({porDocumento.filter((item) => item.clasificacion === clave).length})
          </button>
        ))}
      </div>
      <div className="lista">
        {porFecha.map((grupo) => (
          <section key={grupo.fecha} className="grupo-fecha">
            <h2 className="titulo-fecha">{grupo.dia} {formatearFecha(grupo.fecha)}</h2>
            {grupo.items.map((horario) => (
              <article key={horario.id} className="tarjeta">
                <div className="fila-espacio">
                  <div>
                    <h2>{horario.medico_nombre}</h2>
                    <p>Documento {horario.medico_documento || 'sin cédula'}</p>
                    <p>
                      {horario.hora_inicio.slice(0, 5)} a {horario.hora_fin.slice(0, 5)}
                      {' · '}
                      {horario.duracion_minutos} min
                    </p>
                    <span className={`estado estado-${horario.clasificacion}`}>
                      {ETIQUETAS[horario.clasificacion] || horario.clasificacion}
                    </span>
                  </div>
                  <div className="fila">
                    <button type="button" className="boton" onClick={() => verCitas(horario)}>
                      Ver citas
                    </button>
                    {horario.clasificacion !== 'vencida' && (
                      <button type="button" className="boton boton-suave" onClick={() => onEliminar(horario.id)}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}
        {visibles.length === 0 && <p>No hay jornadas en esta clasificación.</p>}
      </div>
    </div>
  )
}
