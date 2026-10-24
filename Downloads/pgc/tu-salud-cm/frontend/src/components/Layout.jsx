import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const ENLACES = {
  paciente: [
    ['/agendar', 'Agendar'],
    ['/citas', 'Mis citas'],
    ['/resultados', 'Resultados'],
    ['/menores', 'Menores'],
  ],
  medico: [
    ['/calendario', 'Calendario'],
    ['/cargar-resultado', 'Cargar resultado'],
  ],
  admin: [
    ['/solicitudes', 'Solicitudes'],
    ['/analitica', 'Analítica'],
    ['/horarios', 'Horarios'],
  ],
}

export default function Layout() {
  const { usuario, salir } = useAuth()
  const navegar = useNavigate()
  const enlaces = ENLACES[usuario.rol] || []

  async function cerrar() {
    await salir()
    navegar('/login')
  }

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <span className="marca-cruz">+</span>
          <div>
            <strong>Tu Salud CM</strong>
            <small>Hospital El Salvador de Ubaté</small>
          </div>
        </div>
        <nav className="menu">
          {enlaces.map(([ruta, texto]) => (
            <NavLink key={ruta} to={ruta}>{texto}</NavLink>
          ))}
          <NavLink to="/seguridad">Seguridad</NavLink>
        </nav>
        <div className="sesion">
          <span>{usuario.nombres} {usuario.apellidos}</span>
          <button type="button" className="boton boton-suave" onClick={cerrar}>Salir</button>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
