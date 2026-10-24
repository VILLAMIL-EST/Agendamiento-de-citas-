import { api } from '../../../services/api'

export function iniciarSesion(identificador, password) {
  return api.post('/auth/login/', { identificador, password })
}

export function verificarSegundoFactor(preAuth, codigo) {
  return api.post('/auth/login/2fa/', { pre_auth: preAuth, codigo })
}

export function registrarPaciente(payload) {
  return api.post('/auth/registro/', payload)
}

export function renovarSesion() {
  return api.post('/auth/refresh/')
}

export function cerrarSesion() {
  return api.post('/auth/salir/')
}

export function recuperarClave(identificador) {
  return api.post('/auth/recuperar/', { identificador })
}

export function verificarCorreo(token) {
  return api.get(`/auth/verificar-email/${token}/`)
}

export function activarSegundoFactor() {
  return api.post('/auth/2fa/activar/')
}

export function confirmarSegundoFactor(codigo) {
  return api.post('/auth/2fa/confirmar/', { codigo })
}

export function listarMenores() {
  return api.get('/auth/menores/')
}

export function crearMenor(payload) {
  return api.post('/auth/menores/', payload)
}
