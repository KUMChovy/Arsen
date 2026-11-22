import { useState } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import type { SessionTargetProposal } from '../services'

export function RoutineTargetReview({ disabled, onConfirm, proposals }: {
  disabled: boolean
  onConfirm: (proposals: SessionTargetProposal[]) => void
  proposals: SessionTargetProposal[]
}) {
  const [selected, setSelected] = useState<string[]>([])
  const selectedProposals = proposals.filter((proposal) => selected.includes(`${proposal.exerciseId}:${proposal.field}`))
  if (!proposals.length) return null
  return <div className="space-y-3">
    <p className="text-sm text-arsen-muted">Compara tus objetivos con las series principales registradas. Una sesión incompleta puede tener menos series de las planeadas.</p>
    {proposals.map((proposal) => {
      const key = `${proposal.exerciseId}:${proposal.field}`
      return <label className="flex min-h-12 items-center gap-3 rounded-[10px] border border-white/10 p-3 text-sm" key={key}>
        <input checked={selected.includes(key)} disabled={disabled} onChange={(event) => setSelected((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} type="checkbox" />
        <span><strong className="block">{proposal.name} · {proposal.field === 'sets' ? 'Series' : 'Repeticiones'}</strong>{proposal.previous} → {proposal.proposed}</span>
      </label>
    })}
    <ActionButton className="w-full" disabled={disabled || !selectedProposals.length} onClick={() => onConfirm(selectedProposals)} tone="acid" type="button">Confirmar objetivos</ActionButton>
  </div>
}
