import { useRef, type PropsWithChildren } from 'react'

export function SwipeNotice({ children, onDismiss }: PropsWithChildren<{ onDismiss: () => void }>) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return <div onTouchStart={(event) => { const point = event.touches[0]; start.current = point ? { x: point.clientX, y: point.clientY } : null }} onTouchEnd={(event) => {
    const point = event.changedTouches[0]
    if (point && start.current && Math.abs(point.clientX - start.current.x) >= 70 && Math.abs(point.clientX - start.current.x) > Math.abs(point.clientY - start.current.y)) { event.preventDefault(); onDismiss() }
    start.current = null
  }} onTouchCancel={() => { start.current = null }}>
    {children}
    <button className="min-h-11 px-3 text-xs font-semibold text-arsen-muted" onClick={onDismiss} type="button">Descartar aviso</button>
  </div>
}
