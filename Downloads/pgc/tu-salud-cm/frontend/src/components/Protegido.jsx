import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Cargando from './Cargando'

export default function Protegido({ rol }) {
  const { usuario, listo } = useAuth()
  const ubicacion = useLocation()
  if (!listo) return <Cargando texto="Comprobando la sesión…" />
  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ desde: `${ubicacion.pathname}${ubicacion.search}` }}
      />
    )
  }
  if (rol && usuario.rol !== rol) return <Navigate to="/" replace />
  return <Outlet />
}
