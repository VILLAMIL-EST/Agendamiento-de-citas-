import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Alerta from '../../../components/Alerta'
import { mensajeError } from '../../../services/api'
import { consultarAnalitica } from '../services/adminService'

function fechaISO(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function mostrarFecha(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = String(iso).split('-')
  return `${dia}/${mes}/${anio}`
}

function rangoInicial() {
  const hasta = new Date()
  const desde = new Date()
  desde.setDate(hasta.getDate() - 13)
  return { desde: fechaISO(desde), hasta: fechaISO(hasta) }
}

const METRICAS = [
  ['confirmado', 'Confirmadas', 'Aún dentro del plazo de asistencia'],
  ['atendido', 'Atendidas', 'Pacientes que asistieron'],
  ['no_asistio', 'No asistió', 'Inasistencias registradas'],
  ['inconsistencia', 'Inconsistencia', 'El médico no registró la asistencia a tiempo'],
]

export default function Dashboard() {
  const inicial = useMemo(() => rangoInicial(), [])
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [consulta, setConsulta] = useState(inicial)
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    consultarAnalitica(consulta)
      .then(({ data }) => setResumen(data))
      .catch((err) => setError(mensajeError(err)))
  }, [consulta])

  function aplicar(evento) {
    evento.preventDefault()
    setError('')
    setConsulta({ desde, hasta })
  }

  return (
    <section className="analitica">
      <p className="sobrelinea">Gerencia</p>
      <h1>Analítica</h1>
      <Alerta>{error}</Alerta>
      <form className="tarjeta panel-filtro" onSubmit={aplicar}>
        <label>
          Desde
          <input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} required />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} required />
        </label>
        <button className="boton" type="submit">Consultar</button>
      </form>
      {resumen && (
        <>
          <div className="rejilla metricas">
            {METRICAS.map(([clave, titulo, detalle]) => (
              <article key={clave} className={`tarjeta metrica metrica-${clave}`}>
                <span>{titulo}</span>
                <strong>{resumen.totales[clave]}</strong>
                <p>{detalle}</p>
              </article>
            ))}
          </div>
          <article className="tarjeta panel-grafica">
            <div className="fila-espacio">
              <div>
                <h2>Asistencia por día</h2>
                <p className="nota">
                  {resumen.cupos_en_ventana} cupos en el rango · {mostrarFecha(resumen.desde)} a {mostrarFecha(resumen.hasta)}
                </p>
              </div>
            </div>
            {resumen.serie.length === 0 ? (
              <p className="nota vacio-grafica">No hay citas confirmadas, atendidas, de inasistencia o de inconsistencia en ese rango.</p>
            ) : (
              <div className="grafica">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resumen.serie} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ddd6c8" vertical={false} />
                    <XAxis dataKey="etiqueta" tick={{ fill: '#5d6d69', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#5d6d69', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(14, 107, 102, 0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #ddd6c8' }}
                    />
                    <Legend />
                    <Bar dataKey="confirmado" name="Confirmadas" stackId="citas" fill="#0e6b66" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="atendido" name="Atendidas" stackId="citas" fill="#1f7a4d" />
                    <Bar dataKey="no_asistio" name="No asistió" stackId="citas" fill="#9d3b32" />
                    <Bar dataKey="inconsistencia" name="Inconsistencia" stackId="citas" fill="#a87424" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  )
}
