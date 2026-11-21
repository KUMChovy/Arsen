export function NumberField({ disabled, errorId, label, onChange, step, value }: { disabled?: boolean; errorId?: string; label: string; onChange: (value: string) => void; step?: number; value: string }) {
  const adjust = (amount: number) => onChange(String(Math.max(0, Math.round(((Number(value) || 0) + amount) * 100) / 100)))
  return <div className="min-w-0">
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <input aria-describedby={errorId} aria-invalid={errorId ? true : undefined} className="min-h-12 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-center text-base font-extrabold text-arsen-ink disabled:cursor-not-allowed" disabled={disabled} inputMode="decimal" onChange={(event) => onChange(event.target.value)} type="number" value={value} />
    </label>
    {step ? <div className="mt-1 grid grid-cols-2 gap-1">
      <button aria-label={`Reducir ${label}`} className="min-h-12 rounded-[10px] bg-arsen-surface2 text-lg font-bold disabled:opacity-40" disabled={disabled} onClick={() => adjust(-step)} type="button">−</button>
      <button aria-label={`Aumentar ${label}`} className="min-h-12 rounded-[10px] bg-arsen-surface2 text-lg font-bold disabled:opacity-40" disabled={disabled} onClick={() => adjust(step)} type="button">+</button>
    </div> : null}
  </div>
}
