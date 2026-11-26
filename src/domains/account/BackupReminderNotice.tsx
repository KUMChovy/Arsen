import { ArrowRight, Cloud } from 'lucide-react'
import { SwipeNotice } from '../../shared/components/SwipeNotice'

export function BackupReminderNotice({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  return <SwipeNotice onDismiss={onDismiss}>
    <button aria-label="Revisar respaldo" className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-arsen-purple/45 bg-arsen-purple/10 p-3 text-left" onClick={onOpen} type="button">
      <Cloud aria-hidden="true" className="size-6 shrink-0 text-arsen-purple2" />
      <span className="min-w-0 flex-1"><strong className="block text-sm">Es el último día de tu rutina</strong><span className="mt-1 block text-sm text-arsen-muted">Si quieres, revisa tu cuenta y prepara un respaldo manual.</span></span>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-arsen-purple2" />
    </button>
  </SwipeNotice>
}
