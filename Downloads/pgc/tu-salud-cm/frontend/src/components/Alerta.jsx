export default function Alerta({ tipo = 'error', children }) {
  if (!children) return null
  return <p className={`alerta alerta-${tipo}`}>{children}</p>
}
