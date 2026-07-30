import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card } from '../../../shared/components/Card'

type TrainingCalendarSheetProps = {
  dates: string[]
  onClose: () => void
  onSelect: (date: string) => void
}

export function TrainingCalendarSheet({ dates, onClose, onSelect }: TrainingCalendarSheetProps) {
  const latestDate = dates[0] ?? localMonthKey(new Date())
  const [monthDate, setMonthDate] = useState(() => new Date(`${latestDate.slice(0, 7)}-01T12:00:00`))
  const trainedDates = useMemo(() => new Set(dates), [dates])
  const calendarDays = useMemo(() => monthGrid(monthDate), [monthDate])
  const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(monthDate)

  function moveMonth(delta: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12))
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar calendario" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <CalendarDays aria-hidden="true" className="size-5 text-arsen-purple2" />
              Historial
            </h2>
            <p className="mt-1 text-xs font-semibold text-arsen-muted">Selecciona una fecha entrenada.</p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <Card className="p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              aria-label="Mes anterior"
              className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2"
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <strong className="text-sm capitalize">{monthLabel}</strong>
            <button
              aria-label="Mes siguiente"
              className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2"
              onClick={() => moveMonth(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-arsen-muted">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              const key = date ? localDateKey(date) : ''
              const enabled = key ? trainedDates.has(key) : false

              return (
                <button
                  aria-label={key ? `Ver sesiones del ${formatDate(key)}` : 'Dia vacio'}
                  className={[
                    'aspect-square rounded-[10px] text-sm font-extrabold',
                    enabled ? 'border border-arsen-purple2 bg-arsen-purple/35 text-white' : 'border border-white/5 bg-white/[0.03] text-arsen-dim',
                  ].join(' ')}
                  disabled={!enabled}
                  key={key || `empty-${index}`}
                  onClick={() => {
                    if (key) onSelect(key)
                  }}
                  type="button"
                >
                  {date ? date.getDate() : ''}
                </button>
              )
            })}
          </div>
        </Card>

        {dates.length === 0 ? <Card className="mt-3 p-4 text-sm text-arsen-muted">Sin entrenos registrados todavia.</Card> : null}
      </section>
    </div>
  )
}

function monthGrid(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12)
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 12))
  }

  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function localMonthKey(date: Date) {
  return `${localDateKey(date).slice(0, 7)}-01`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}
