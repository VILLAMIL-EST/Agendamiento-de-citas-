import { api } from '../../../services/api'

export function buscarResultados(filtros) {
  return api.get('/resultados/', { params: filtros })
}

export function descargarResultado(id) {
  return api.get(`/resultados/${id}/descargar/`, { responseType: 'blob' })
}

export function listarPacientesDelMedico() {
  return api.get('/resultados/pacientes-medico/')
}

export function subirResultado(formulario) {
  return api.post('/resultados/subir/', formulario)
}
