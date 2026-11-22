import { useState } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { formatWeight } from '../../../shared/utils/weight'
import type { SessionWeightProposal } from '../services'
import type { WeightUnit } from '../types'

export function RoutineWeightReview({ disabled, onConfirm, proposals, unit }: {
  disabled: boolean
  onConfirm: (proposals: SessionWeightProposal[]) => void
  proposals: SessionWeightProposal[]
  unit: WeightUnit
}) {
  const [selected, setSelected] = useState<string[]>([])
  const selectedProposals = proposals.filter((proposal) => selected.includes(proposal.exerciseId))
  if (!proposals.length) return <p className="text-sm text-arsen-muted">No hay cambios de peso para aplicar.</p>
  return <div className="space-y-3">
    <p className="text-sm text-arsen-muted">Selecciona los pesos que quieres guardar en esta rutina.</p>
    {proposals.map((proposal) => <label className="flex min-h-12 items-center gap-3 rounded-[10px] border border-white/10 p-3 text-sm" key={proposal.exerciseId}>
      <input checked={selected.includes(proposal.exerciseId)} disabled={disabled} onChange={(event) => setSelected((current) => event.target.checked ? [...current, proposal.exerciseId] : current.filter((id) => id !== proposal.exerciseId))} type="checkbox" />
      <span><strong className="block">{proposal.name}</strong>{formatWeight(proposal.previousWeightKg, unit)} → {formatWeight(proposal.proposedWeightKg, unit)}</span>
    </label>)}
    <ActionButton className="w-full" disabled={disabled || !selectedProposals.length} onClick={() => onConfirm(selectedProposals)} tone="acid" type="button">Confirmar cambios</ActionButton>
  </div>
}
