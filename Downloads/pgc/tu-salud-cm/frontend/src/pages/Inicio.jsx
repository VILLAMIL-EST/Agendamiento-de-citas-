import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const DESTINOS = {
  paciente: [
    ['/agendar', 'Agendar una cita', 'Consulte la oferta del canal web y reserve un cupo de medicina general.'],
    ['/resultados', 'Ver resultados', 'Descargue el PDF protegido con su número de documento.'],
  ],
  medico: [
    ['/calendario', 'Agenda de la semana', 'Revise las citas asignadas y registre la asistencia.'],
    ['/cargar-resultado', 'Cargar un resultado', 'El archivo se cifra antes de guardarse.'],
  ],
  admin: [
    ['/solicitudes', 'Solicitudes', 'Valide altas de pacientes y consulte el historial por documento.'],
    ['/analitica', 'Analítica', 'Asignación de citas, asistencia y ausentismo del canal web.'],
    ['/horarios', 'Horarios y médicos', 'Registre profesionales, defina jornadas y abra los cupos.'],
    ['/seguridad', 'Seguridad', 'Active el segundo factor y revise el acceso de esta cuenta.'],
  ],
}

export default function Inicio() {
  const { usuario } = useAuth()
  const tarjetas = DESTINOS[usuario.rol] || []
  return (
    <section>
      <p className="sobrelinea">Servicios ambulatorios</p>
      <h1>Hola, {usuario.nombres}</h1>
      <p className="lead">
        Este canal gestiona citas de medicina general. No reemplaza el servicio de urgencias
        ni la historia clínica institucional.
      </p>
      <div className="rejilla">
        {tarjetas.map(([ruta, titulo, texto]) => (
          <Link key={ruta} to={ruta} className="tarjeta tarjeta-enlace">
            <h2>{titulo}</h2>
            <p>{texto}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
