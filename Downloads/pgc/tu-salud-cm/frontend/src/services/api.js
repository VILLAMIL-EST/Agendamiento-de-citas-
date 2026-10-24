import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let accessToken = null
let renovacion = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error) => {
    const original = error.config || {}
    const url = original.url || ''
    const esAuth = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/registro')
    if (error.response?.status === 401 && !original._reintento && !esAuth) {
      original._reintento = true
      renovacion = renovacion || api.post('/auth/refresh/')
        .then(({ data }) => {
          accessToken = data.access
          return data.access
        })
        .finally(() => {
          renovacion = null
        })
      try {
        const token = await renovacion
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch {
        accessToken = null
      }
    }
    return Promise.reject(error)
  },
)

export function mensajeError(error) {
  const data = error?.response?.data
  if (!data) return 'No fue posible conectar con el servidor.'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([campo, valor]) => {
        const texto = Array.isArray(valor) ? valor.join(' ') : String(valor)
        return campo === 'detail' ? texto : `${campo}: ${texto}`
      })
      .join(' ')
  }
  return 'Ocurrió un error al procesar la solicitud.'
}
