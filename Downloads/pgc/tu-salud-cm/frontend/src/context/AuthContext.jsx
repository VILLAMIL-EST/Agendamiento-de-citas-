import { createContext, useEffect, useMemo, useState } from 'react'
import {
  cerrarSesion,
  iniciarSesion,
  registrarPaciente,
  renovarSesion,
  verificarSegundoFactor,
} from '../modules/login/services/authService'
import { setAccessToken } from '../services/api'

export const AuthContext = createContext(null)

const INACTIVIDAD_MS = 30 * 60 * 1000

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [listo, setListo] = useState(false)

  function abrirSesion(data) {
    setAccessToken(data.access)
    setUsuario(data.usuario)
  }

  async function entrar(identificador, password) {
    const { data } = await iniciarSesion(identificador, password)
    if (data.requires_2fa) return data
    abrirSesion(data)
    return data
  }

  async function verificar2fa(preAuth, codigo) {
    const { data } = await verificarSegundoFactor(preAuth, codigo)
    abrirSesion(data)
    return data
  }

  async function registrar(payload) {
    const { data } = await registrarPaciente(payload)
    return data
  }

  async function salir() {
    try {
      await cerrarSesion()
    } catch {
      // Si el refresh ya no existe, igual se limpia la sesión en memoria.
    }
    setAccessToken(null)
    setUsuario(null)
  }

  useEffect(() => {
    let activo = true
    renovarSesion()
      .then(({ data }) => {
        if (!activo) return
        abrirSesion(data)
      })
      .catch(() => {
        if (activo) setAccessToken(null)
      })
      .finally(() => {
        if (activo) setListo(true)
      })
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!usuario) return undefined
    let temporizador
    const reiniciar = () => {
      window.clearTimeout(temporizador)
      temporizador = window.setTimeout(() => {
        salir()
      }, INACTIVIDAD_MS)
    }
    const eventos = ['click', 'keydown', 'mousemove']
    eventos.forEach((evento) => window.addEventListener(evento, reiniciar))
    reiniciar()
    return () => {
      window.clearTimeout(temporizador)
      eventos.forEach((evento) => window.removeEventListener(evento, reiniciar))
    }
  }, [usuario])

  const valor = useMemo(
    () => ({ usuario, listo, entrar, verificar2fa, registrar, salir }),
    [usuario, listo],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
