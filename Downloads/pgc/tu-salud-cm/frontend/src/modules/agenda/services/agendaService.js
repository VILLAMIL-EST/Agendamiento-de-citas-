import { api } from '../../../services/api'

export function listarMedicos() {
  return api.get('/agenda/medicos/')
}

export function consultarDisponibilidad(medico, fecha) {
  return api.get('/agenda/disponibilidad/', { params: { medico, fecha } })
}

export function listarFechasDisponibles(medico) {
  return api.get('/agenda/fechas-disponibles/', { params: { medico } })
}

export function bloquearCupo(citaId) {
  return api.post('/agenda/citas/bloquear/', { cita_id: citaId })
}

export function confirmarCupo(citaId, payload) {
  return api.post(`/agenda/citas/${citaId}/confirmar/`, payload)
}

export function liberarCupo(citaId) {
  return api.post(`/agenda/citas/${citaId}/liberar/`)
}

export function listarMisCitas() {
  return api.get('/agenda/citas/mias/')
}

export function cancelarCita(citaId) {
  return api.post(`/agenda/citas/${citaId}/cancelar/`)
}

export function calendarioMedico(params) {
  return api.get('/agenda/medico/calendario/', { params })
}

export function registrarAsistencia(citaId, estado) {
  return api.post(`/agenda/citas/${citaId}/asistencia/`, { estado })
}

export function listarHorarios() {
  return api.get('/agenda/horarios/')
}

export function crearHorario(payload) {
  return api.post('/agenda/horarios/', payload)
}

export function eliminarHorario(horarioId) {
  return api.delete(`/agenda/horarios/${horarioId}/`)
}

export function listarCitasHorario(horarioId) {
  return api.get(`/agenda/horarios/${horarioId}/citas/`)
}

export function generarCupos(payload) {
  return api.post('/agenda/cupos/generar/', payload)
}
