import { useEffect, useMemo, useState } from 'react'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { descargarResultado, listarResultadosDeCita, subirResultado } from '../../clinica/services/clinicaService'
import { calendarioMedico, registrarAsistencia } from '../services/agendaService'
import { formatearFecha } from '../utils/fechas'

const PLAZO_MS = 30 * 60 * 1000
const AVISO_ANTES = 'Podrá modificar la cita desde su hora de inicio y hasta 30 minutos después de que termine.'
const AVISO_VENCIDO = 'La cita ya venció. Solo puede consultar la información, el motivo y los documentos cargados.'
const TIPOS_PDF = {
  reporte: 'Reporte clínico',
  laboratorio: 'Laboratorio',
  formula: 'Fórmula médica',
}
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const ETIQUETAS = {
  confirmado: 'Confirmada',
  atendido: 'Asistió',
  no_asistio: 'No asistió',
  bloqueado: 'Reservada',
  inconsistencia: 'Inconsistencia',
}
const DOCUMENTOS = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  RC: 'Registro civil',
  CE: 'Cédula de extranjería',
}
const PDF_VACIO = { titulo: '', tipo: 'reporte', archivo: null }

function fechaISO(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function hoyISO() {
  return fechaISO(new Date())
}

function fechaDeEvento(evento) {
  const fecha = new Date(evento.start)
  if (Number.isNaN(fecha.getTime())) return ''
  return fechaISO(fecha)
}

function horaDe(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function plazoAsistencia(inicioIso, finIso, ahora) {
  const inicio = new Date(inicioIso)
  const fin = new Date(finIso || inicioIso)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return { fase: 'vencido' }
  const limite = fin.getTime() + PLAZO_MS
  if (ahora.getTime() < inicio.getTime()) return { fase: 'antes' }
  if (ahora.getTime() <= limite) {
    return { fase: 'abierto', minutos: Math.max(1, Math.ceil((limite - ahora.getTime()) / 60000)) }
  }
  return { fase: 'vencido' }
}

function estadoVisible(cita, ahora) {
  if (
    cita.estado === 'confirmado'
    && plazoAsistencia(cita.start, cita.end, ahora).fase === 'vencido'
  ) {
    return 'inconsistencia'
  }
  return cita.estado
}

function tituloMes(anio, mes) {
  const texto = new Date(anio, mes, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function celdasDelMes(anio, mes, eventos) {
  const primero = new Date(anio, mes, 1)
  const desfase = (primero.getDay() + 6) % 7
  const inicio = new Date(anio, mes, 1 - desfase)
  return Array.from({ length: 42 }, (_, indice) => {
    const fecha = new Date(inicio)
    fecha.setDate(inicio.getDate() + indice)
    const iso = fechaISO(fecha)
    return {
      iso,
      numero: fecha.getDate(),
      enMes: fecha.getMonth() === mes,
      esHoy: iso === hoyISO(),
      citas: eventos.filter((evento) => fechaDeEvento(evento) === iso),
    }
  })
}

export default function CalendarioSemanal() {
  const [vista, setVista] = useState('mes')
  const [cursor, setCursor] = useState(() => {
    const hoy = new Date()
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() }
  })
  const [dia, setDia] = useState('')
  const [citaId, setCitaId] = useState('')
  const [documentos, setDocumentos] = useState([{ ...PDF_VACIO }])
  const [soportes, setSoportes] = useState([])
  const [eventos, setEventos] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [ahora, setAhora] = useState(() => new Date())

  const celdas = useMemo(() => celdasDelMes(cursor.anio, cursor.mes, eventos), [cursor, eventos])
  const citasDelDia = useMemo(
    () => eventos.filter((evento) => fechaDeEvento(evento) === dia).sort((a, b) => a.start.localeCompare(b.start)),
    [eventos, dia],
  )
  const citaActual = eventos.find((item) => String(item.id) === String(citaId)) || null

  function cargarMes(anio, mes) {
    const primero = new Date(anio, mes, 1)
    const desfase = (primero.getDay() + 6) % 7
    const desde = new Date(anio, mes, 1 - desfase)
    const hasta = new Date(desde)
    hasta.setDate(desde.getDate() + 41)
    calendarioMedico({ desde: fechaISO(desde), hasta: fechaISO(hasta) })
      .then(({ data }) => setEventos(data))
      .catch((err) => setError(mensajeError(err)))
  }

  useEffect(() => {
    cargarMes(cursor.anio, cursor.mes)
  }, [cursor.anio, cursor.mes])

  useEffect(() => {
    if (vista !== 'dia' && vista !== 'cita') return undefined
    setAhora(new Date())
    const reloj = window.setInterval(() => setAhora(new Date()), 15000)
    return () => window.clearInterval(reloj)
  }, [vista, dia])

  useEffect(() => {
    if (!citaId) {
      setSoportes([])
      return undefined
    }
    let activo = true
    listarResultadosDeCita(citaId)
      .then(({ data }) => {
        if (activo) setSoportes(data)
      })
      .catch(() => {
        if (activo) setSoportes([])
      })
    return () => {
      activo = false
    }
  }, [citaId])

  function moverMes(delta) {
    setCursor((previo) => {
      const fecha = new Date(previo.anio, previo.mes + delta, 1)
      return { anio: fecha.getFullYear(), mes: fecha.getMonth() }
    })
  }

  function abrirDia(iso) {
    setDia(iso)
    setVista('dia')
    setSeleccionLimpia()
  }

  function setSeleccionLimpia() {
    setError('')
    setAviso('')
  }

  function volverAlMes() {
    setVista('mes')
    setDia('')
    setCitaId('')
    setSeleccionLimpia()
  }

  function abrirCita(id) {
    setCitaId(String(id))
    setDocumentos([{ ...PDF_VACIO }])
    setVista('cita')
    setSeleccionLimpia()
  }

  function volverAlDia() {
    setVista('dia')
    setCitaId('')
    setSeleccionLimpia()
  }

  function cambiarDocumento(indice, campo, valor) {
    setDocumentos((previo) => previo.map((item, posicion) => (
      posicion === indice ? { ...item, [campo]: valor } : item
    )))
  }

  async function marcar(id, estado) {
    const cita = eventos.find((item) => String(item.id) === String(id))
    const plazo = cita ? plazoAsistencia(cita.start, cita.end, new Date()) : { fase: 'vencido' }
    if (plazo.fase !== 'abierto') {
      setError(plazo.fase === 'antes' ? AVISO_ANTES : AVISO_VENCIDO)
      return
    }
    setError('')
    setAviso('')
    setOcupado(id)
    try {
      await registrarAsistencia(id, estado)
      setAviso(estado === 'atendido' ? 'La cita quedó como asistió.' : 'La cita quedó como no asistió.')
      cargarMes(cursor.anio, cursor.mes)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado('')
    }
  }

  async function guardarDocumentos(evento) {
    evento.preventDefault()
    const plazo = citaActual ? plazoAsistencia(citaActual.start, citaActual.end, new Date()) : { fase: 'vencido' }
    if (!citaActual?.paciente_id || plazo.fase !== 'abierto') {
      setError(plazo.fase === 'antes' ? AVISO_ANTES : AVISO_VENCIDO)
      return
    }
    const pendientes = documentos.filter((item) => item.titulo.trim() && item.archivo)
    if (pendientes.length === 0) {
      setError('Escriba el título y adjunte al menos un PDF.')
      return
    }
    setError('')
    setAviso('')
    setOcupado('pdf')
    try {
      for (const item of pendientes) {
        const formulario = new FormData()
        formulario.append('paciente_id', citaActual.paciente_id)
        formulario.append('cita_id', citaActual.id)
        formulario.append('titulo', item.titulo.trim())
        formulario.append('tipo', item.tipo)
        formulario.append('fecha_resultado', fechaDeEvento(citaActual))
        formulario.append('archivo', item.archivo)
        await subirResultado(formulario)
      }
      setDocumentos([{ ...PDF_VACIO }])
      setCitaId('')
      setVista('dia')
      setAviso(pendientes.length === 1
        ? 'El PDF quedó cifrado y asignado a esta cita.'
        : `${pendientes.length} PDF quedaron cifrados y asignados a esta cita.`)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado('')
    }
  }

  async function descargarSoporte(id, titulo) {
    setError('')
    try {
      const respuesta = await descargarResultado(id)
      const url = URL.createObjectURL(respuesta.data)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `${titulo || 'resultado'}.pdf`
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <section>
      <p className="sobrelinea">Agenda del canal web</p>
      <h1>
        {vista === 'mes' && 'Tablero del mes'}
        {vista === 'dia' && 'Tablero del día'}
        {vista === 'cita' && 'Cita seleccionada'}
      </h1>
      <p className="lead">
        {vista === 'mes' && 'Elija un día y entre a la cita para ver al paciente, marcar asistencia y cargar los PDF.'}
        {vista === 'dia' && 'Entre a un horario, por ejemplo de 8:00 a 8:20, para ver la información de esa cita.'}
        {vista === 'cita' && 'Revise los datos del paciente, marque la asistencia y, si asistió, cargue uno o varios PDF.'}
      </p>
      <Alerta>{error}</Alerta>
      <Alerta tipo="ok">{aviso}</Alerta>

      {vista === 'mes' && (
        <article className="tarjeta tablero-mes">
          <div className="fila-espacio">
            <button type="button" className="boton boton-suave" onClick={() => moverMes(-1)}>Mes anterior</button>
            <h2>{tituloMes(cursor.anio, cursor.mes)}</h2>
            <button type="button" className="boton boton-suave" onClick={() => moverMes(1)}>Mes siguiente</button>
          </div>
          <div className="rejilla-mes cabecera-mes">
            {DIAS_CORTO.map((nombre) => <span key={nombre}>{nombre}</span>)}
          </div>
          <div className="rejilla-mes">
            {celdas.map((celda) => (
              <button
                key={celda.iso}
                type="button"
                className={[
                  'celda-mes',
                  celda.enMes ? '' : 'celda-fuera',
                  celda.esHoy ? 'celda-hoy' : '',
                  celda.citas.length ? 'celda-con-citas' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => abrirDia(celda.iso)}
              >
                <strong>{celda.numero}</strong>
                {celda.citas.length > 0 && (
                  <span>{celda.citas.length} {celda.citas.length === 1 ? 'cita' : 'citas'}</span>
                )}
              </button>
            ))}
          </div>
        </article>
      )}

      {vista === 'dia' && (
        <div className="tablero-dia">
          <div className="fila-espacio">
            <button type="button" className="boton boton-suave" onClick={volverAlMes}>Volver al mes</button>
            <h2>{formatearFecha(dia)}</h2>
            <span />
          </div>
          <div className="lista">
            {citasDelDia.map((cita) => (
              <button
                key={cita.id}
                type="button"
                className={`tarjeta cita-dia cita-${cita.estado}`}
                onClick={() => abrirCita(cita.id)}
              >
                <h2>{horaDe(cita.start)} a {horaDe(cita.end)}</h2>
                <p>{cita.title}</p>
                <span className={`estado estado-${estadoVisible(cita, ahora)}`}>
                  {ETIQUETAS[estadoVisible(cita, ahora)] || cita.estado}
                </span>
              </button>
            ))}
            {citasDelDia.length === 0 && <p>No hay citas en este día.</p>}
          </div>
        </div>
      )}

      {vista === 'cita' && citaActual && (
        <DetalleCita
          cita={citaActual}
          ahora={ahora}
          ocupado={ocupado}
          documentos={documentos}
          soportes={soportes}
          onDescargar={descargarSoporte}
          onVolver={volverAlDia}
          onMarcar={marcar}
          onDocumento={cambiarDocumento}
          onAgregar={() => setDocumentos((previo) => [...previo, { ...PDF_VACIO }])}
          onQuitar={(indice) => setDocumentos((previo) => previo.filter((_, posicion) => posicion !== indice))}
          onGuardar={guardarDocumentos}
        />
      )}
    </section>
  )
}

function DetalleCita({
  cita,
  ahora,
  ocupado,
  documentos,
  soportes,
  onVolver,
  onMarcar,
  onDocumento,
  onAgregar,
  onQuitar,
  onGuardar,
  onDescargar,
}) {
  const plazo = plazoAsistencia(cita.start, cita.end, ahora)
  const visible = estadoVisible(cita, ahora)
  const puedeModificar = plazo.fase === 'abierto'
  const puedeAsistencia = puedeModificar && ['confirmado', 'atendido', 'no_asistio'].includes(cita.estado)
  const puedeCargar = puedeModificar && cita.estado === 'atendido' && Boolean(cita.paciente_id)

  return (
    <div className="tablero-dia">
      <div className="fila-espacio">
        <button type="button" className="boton boton-suave" onClick={onVolver}>Volver al día</button>
        <h2>{horaDe(cita.start)} a {horaDe(cita.end)}</h2>
        <span />
      </div>

      <article className="tarjeta">
        <p className="sobrelinea">Paciente</p>
        <h2>{cita.nombres} {cita.apellidos}</h2>
        <p>{DOCUMENTOS[cita.tipo_documento] || cita.tipo_documento} {cita.numero_documento}</p>
        {cita.fecha_nacimiento && <p>Nacimiento: {formatearFecha(cita.fecha_nacimiento)}</p>}
        {cita.telefono && <p>Teléfono: {cita.telefono}</p>}
        {cita.email && <p>Correo: {cita.email}</p>}
        {cita.tutor_nombre && <p>Tutor: {cita.tutor_nombre}</p>}
        <p>Motivo: {cita.motivo || 'Sin motivo registrado'}</p>
        <span className={`estado estado-${visible}`}>{ETIQUETAS[visible] || cita.estado}</span>
      </article>

      <article className="tarjeta">
        <p className="sobrelinea">Asistencia</p>
        <h2>¿El paciente asistió?</h2>
        {plazo.fase === 'antes' && <p className="nota">{AVISO_ANTES}</p>}
        {plazo.fase === 'abierto' && (
          <p className="nota">Quedan {plazo.minutos} {plazo.minutos === 1 ? 'minuto' : 'minutos'} para modificar esta cita.</p>
        )}
        {plazo.fase === 'vencido' && <p className="alerta alerta-error">{AVISO_VENCIDO}</p>}
        {puedeAsistencia && (
          <div className="fila">
            <button type="button" className="boton" disabled={ocupado === String(cita.id)} onClick={() => onMarcar(cita.id, 'atendido')}>
              Asistió
            </button>
            <button type="button" className="boton boton-suave" disabled={ocupado === String(cita.id)} onClick={() => onMarcar(cita.id, 'no_asistio')}>
              No asistió
            </button>
          </div>
        )}
      </article>

      <article className="tarjeta">
        <p className="sobrelinea">Documentos</p>
        <h2>{puedeModificar ? 'Cargar PDF' : 'Documentos cargados'}</h2>
        {soportes.length > 0 && (
          <div className="lista">
            {soportes.map((item) => (
              <article key={item.id} className="soporte-pdf">
                <div>
                  <strong>{item.titulo}</strong>
                  <p>{TIPOS_PDF[item.tipo] || item.tipo} · {item.fecha_resultado}</p>
                </div>
                <button type="button" className="boton boton-suave" onClick={() => onDescargar(item.id, item.titulo)}>
                  Ver soporte
                </button>
              </article>
            ))}
          </div>
        )}
        {!puedeModificar && soportes.length === 0 && <p className="nota">No se cargaron documentos en esta cita.</p>}
        {puedeCargar && (
          <form className="formulario" onSubmit={onGuardar}>
            {documentos.map((item, indice) => (
              <div key={indice} className="bloque-pdf">
                <label>Título<input value={item.titulo} onChange={(evento) => onDocumento(indice, 'titulo', evento.target.value)} maxLength={160} /></label>
                <label>
                  Tipo
                  <select value={item.tipo} onChange={(evento) => onDocumento(indice, 'tipo', evento.target.value)}>
                    <option value="reporte">Reporte clínico</option>
                    <option value="laboratorio">Laboratorio</option>
                    <option value="formula">Fórmula médica</option>
                  </select>
                </label>
                <label>
                  PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(evento) => onDocumento(indice, 'archivo', evento.target.files?.[0] || null)}
                  />
                </label>
                {documentos.length > 1 && (
                  <button type="button" className="enlace" onClick={() => onQuitar(indice)}>Quitar este PDF</button>
                )}
              </div>
            ))}
            <div className="fila">
              <button type="button" className="boton boton-suave" onClick={onAgregar}>Agregar otro PDF</button>
              <button type="submit" className="boton" disabled={ocupado === 'pdf'}>
                {ocupado === 'pdf' ? 'Cifrando…' : 'Asignar PDF'}
              </button>
            </div>
          </form>
        )}
        {puedeModificar && !puedeCargar && cita.estado !== 'no_asistio' && (
          <p className="nota">Marque que el paciente asistió para cargar uno o varios PDF de esta cita.</p>
        )}
        {puedeModificar && cita.estado === 'no_asistio' && (
          <p className="nota">No se cargan documentos cuando el paciente no asistió.</p>
        )}
      </article>
    </div>
  )
}
