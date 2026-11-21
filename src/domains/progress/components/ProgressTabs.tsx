export type ProgressView = 'summary' | 'exercises' | 'history'

export function ProgressTabs({ onChange, value }: { onChange: (view: ProgressView) => void; value: ProgressView }) {
  return (
    <div aria-label="Vistas de progreso" className="grid grid-cols-3 gap-1 rounded-[12px] border border-white/10 bg-arsen-bg/60 p-1" role="tablist">
      {[
        ['summary', 'Resumen'],
        ['exercises', 'Ejercicios'],
        ['history', 'Historial'],
      ].map(([view, label]) => (
        <button
          aria-selected={value === view}
          className={[
            'min-h-11 rounded-[10px] px-2 text-xs font-black transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arsen-acid',
            value === view ? 'bg-arsen-purple/35 text-arsen-ink' : 'text-arsen-muted hover:bg-white/5',
          ].join(' ')}
          key={view}
          onClick={() => onChange(view as ProgressView)}
          role="tab"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
