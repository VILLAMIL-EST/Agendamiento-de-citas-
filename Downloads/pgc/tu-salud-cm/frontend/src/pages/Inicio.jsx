import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const DESTINOS = {
  paciente: [
    ['/agendar', 'Agendar una cita', 'Consulte la oferta del canal web y reserve un cupo de medicina general.'],
    ['/resultados', 'Ver resultados', 'Descargue el PDF protegido con su número de documento.'],
  ],
  medico: [
    ['/calendario', 'Agenda del mes', 'Entre a la cita para ver al paciente, marcar asistencia y cargar los PDF.'],
  ],
  admin: [
    ['/solicitudes', 'Solicitudes', 'Valide altas de titulares, tutelas de menores y el historial por documento.'],
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
