import { useMemo, useState } from 'react'

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

export default function ListaJornadas({ horarios, filtro, documento, onFiltro, onDocumento, onEliminar }) {
  const [orden, setOrden] = useState('asc')
  const porDocumento = horarios.filter((horario) => coincideDocumento(horario.medico_documento, documento))
  const visibles = useMemo(() => {
    const filtradas = filtro === 'todas'
      ? porDocumento
      : porDocumento.filter((horario) => horario.clasificacion === filtro)
    return [...filtradas].sort((a, b) => compararJornadas(a, b, orden))
  }, [porDocumento, filtro, orden])
  const porFecha = agruparPorFecha(visibles)

  return (
    <div>
      <p className="nota">
        Las propuestas esperan que abra cupos. Las activas ya se pueden agendar. Las vencidas quedan de consulta.
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
              <article key={horario.id} className="tarjeta fila-espacio">
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
                {horario.clasificacion !== 'vencida' && (
                  <button type="button" className="boton boton-suave" onClick={() => onEliminar(horario.id)}>
                    Eliminar
                  </button>
                )}
              </article>
            ))}
          </section>
        ))}
        {visibles.length === 0 && <p>No hay jornadas en esta clasificación.</p>}
      </div>
    </div>
  )
}
