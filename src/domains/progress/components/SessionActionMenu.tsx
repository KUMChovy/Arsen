import { MoreVertical } from 'lucide-react'
import { useState } from 'react'

type SessionActionMenuProps = {
  onCompare?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onEdit: () => void
  onExport?: () => void
  onExportJson?: () => void
}

export function SessionActionMenu({ onCompare, onDelete, onDuplicate, onEdit, onExport, onExportJson }: SessionActionMenuProps) {
  const [open, setOpen] = useState(false)

  function choose(action?: () => void) {
    setOpen(false)
    action?.()
  }

  return (
    <div className="relative">
      <button aria-expanded={open} aria-haspopup="menu" aria-label="Acciones de sesión" className="grid size-10 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" onClick={() => setOpen((value) => !value)} type="button">
        <MoreVertical aria-hidden="true" className="size-5" />
      </button>
      {open ? <div aria-label="Acciones de sesión" className="absolute right-0 z-10 mt-2 min-w-48 rounded-xl border border-white/10 bg-arsen-surface p-1 shadow-xl" role="menu">
        <MenuButton label="Editar sesión" onClick={() => choose(onEdit)} />
        <MenuButton label="Duplicar sesión" onClick={() => choose(onDuplicate)} disabled={!onDuplicate} />
        <MenuButton label="Comparar" onClick={() => choose(onCompare)} disabled={!onCompare} />
        <MenuButton label="Exportar sesión" onClick={() => choose(onExport)} disabled={!onExport} />
        <MenuButton label="Exportar JSON" onClick={() => choose(onExportJson)} disabled={!onExportJson} />
        <MenuButton label="Eliminar sesión" onClick={() => choose(onDelete)} disabled={!onDelete} destructive />
      </div> : null}
    </div>
  )
}

function MenuButton({ label, onClick, disabled = false, destructive = false }: { label: string; onClick: () => void; disabled?: boolean; destructive?: boolean }) {
  return <button className={['flex min-h-10 w-full items-center rounded-[10px] px-3 text-left text-sm font-bold', destructive ? 'text-red-300' : 'text-arsen-text', disabled ? 'opacity-40' : 'hover:bg-white/5'].join(' ')} disabled={disabled} onClick={onClick} type="button">{label}</button>
}
