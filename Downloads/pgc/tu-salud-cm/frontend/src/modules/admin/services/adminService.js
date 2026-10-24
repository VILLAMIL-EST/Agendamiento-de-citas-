import { api } from '../../../services/api'

export function listarSolicitudes() {
  return api.get('/auth/solicitudes/')
}

export function listarHistorialSolicitudes() {
  return api.get('/auth/solicitudes/', { params: { vista: 'historial' } })
}

export function aprobarSolicitud(id) {
  return api.post(`/auth/solicitudes/${id}/aprobar/`, {})
}

export function rechazarSolicitud(id, motivo) {
  return api.post(`/auth/solicitudes/${id}/rechazar/`, { motivo })
}

export function decidirSolicitud(token, motivo) {
  return api.post('/auth/solicitudes/decision/', { token, motivo })
}

export function consultarAnalitica(params) {
  return api.get('/analitica/resumen/', { params })
}

export function listarMedicosAdmin() {
  return api.get('/auth/medicos/')
}

export function crearMedico(payload) {
  return api.post('/auth/medicos/', payload)
}
