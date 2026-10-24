const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function formatearFecha(valor) {
  if (!valor) return ''
  const fecha = new Date(`${valor}T00:00:00`)
  const dia = DIAS[fecha.getDay()]
  return `${dia} ${fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`
}
