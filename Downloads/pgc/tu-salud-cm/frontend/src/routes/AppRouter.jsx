import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Cargando from '../components/Cargando'
import Layout from '../components/Layout'
import Protegido from '../components/Protegido'

const Login = lazy(() => import('../modules/login/pages/Login'))
const Registro = lazy(() => import('../modules/login/pages/Registro'))
const VerificarEmail = lazy(() => import('../modules/login/pages/VerificarEmail'))
const Seguridad = lazy(() => import('../modules/login/pages/Seguridad'))
const Menores = lazy(() => import('../modules/login/pages/Menores'))
const Inicio = lazy(() => import('../pages/Inicio'))
const AgendarCita = lazy(() => import('../modules/agenda/pages/AgendarCita'))
const MisCitas = lazy(() => import('../modules/agenda/pages/MisCitas'))
const CalendarioSemanal = lazy(() => import('../modules/agenda/pages/CalendarioSemanal'))
const Horarios = lazy(() => import('../modules/agenda/pages/Horarios'))
const Resultados = lazy(() => import('../modules/clinica/pages/Resultados'))
const Solicitudes = lazy(() => import('../modules/admin/pages/Solicitudes'))
const DecidirSolicitud = lazy(() => import('../modules/admin/pages/DecidirSolicitud'))
const Dashboard = lazy(() => import('../modules/admin/pages/Dashboard'))

export default function AppRouter() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/verificar-email/:token" element={<VerificarEmail />} />
        <Route element={<Protegido />}>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="seguridad" element={<Seguridad />} />
            <Route element={<Protegido rol="paciente" />}>
              <Route path="agendar" element={<AgendarCita />} />
              <Route path="citas" element={<MisCitas />} />
              <Route path="resultados" element={<Resultados />} />
              <Route path="menores" element={<Menores />} />
            </Route>
            <Route element={<Protegido rol="medico" />}>
              <Route path="calendario" element={<CalendarioSemanal />} />
              <Route path="cargar-resultado" element={<Navigate to="/calendario" replace />} />
            </Route>
            <Route element={<Protegido rol="admin" />}>
              <Route path="solicitudes" element={<Solicitudes />} />
              <Route path="solicitudes/decidir" element={<DecidirSolicitud />} />
              <Route path="analitica" element={<Dashboard />} />
              <Route path="horarios" element={<Horarios />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
