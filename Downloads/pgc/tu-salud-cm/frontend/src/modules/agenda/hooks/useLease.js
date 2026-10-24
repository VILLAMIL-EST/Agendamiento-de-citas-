import { useEffect, useState } from 'react'

function segundosRestantes(expiraEn) {
  if (!expiraEn) return 0
  const fin = new Date(expiraEn).getTime()
  if (Number.isNaN(fin)) return 0
  return Math.max(0, Math.floor((fin - Date.now()) / 1000))
}

export function useLease(expiraEn) {
  const [marca, setMarca] = useState(expiraEn)
  const [restante, setRestante] = useState(() => segundosRestantes(expiraEn))

  if (marca !== expiraEn) {
    setMarca(expiraEn)
    setRestante(segundosRestantes(expiraEn))
  }

  useEffect(() => {
    if (!expiraEn) return undefined
    const id = window.setInterval(() => setRestante(segundosRestantes(expiraEn)), 1000)
    return () => window.clearInterval(id)
  }, [expiraEn])

  const minutos = String(Math.floor(restante / 60)).padStart(2, '0')
  const segundos = String(restante % 60).padStart(2, '0')
  return { restante, texto: `${minutos}:${segundos}` }
}
