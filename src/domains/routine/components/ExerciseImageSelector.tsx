import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Search, X } from 'lucide-react'
import { bundledExerciseAssets, getBundledExerciseAsset, searchableTextForBundledAsset } from '../../../shared/assets/exerciseImages'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import type { ExerciseAsset, MuscleGroup } from '../types'
import { muscleGroups } from '../utils/muscles'

export type ExerciseImageSelection = {
  bundledAssetId: string | null
  customAssetId: string | null
}

type ExerciseImageSelectorProps = {
  assets: ExerciseAsset[]
  disabled: boolean
  error: string | null
  mainMuscle: MuscleGroup
  onChange: (selection: ExerciseImageSelection) => void
  onClose: () => void
  onUpload: (file: File) => void
  selection: ExerciseImageSelection
}

export function ExerciseImageSelector({ assets, disabled, error, mainMuscle, onChange, onClose, onUpload, selection }: ExerciseImageSelectorProps) {
  const [draftSelection, setDraftSelection] = useState(selection)
  const [activeMuscle, setActiveMuscle] = useState<MuscleGroup | 'Todos'>(mainMuscle)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('es-MX')
  const selectedCustomAsset = draftSelection.customAssetId ? assets.find((asset) => asset.id === draftSelection.customAssetId) ?? null : null
  const selectedBundledAsset = getBundledExerciseAsset(draftSelection.bundledAssetId)
  const visibleBundledAssets = useMemo(
    () =>
      bundledExerciseAssets.filter((asset) => {
        const muscleMatches = activeMuscle === 'Todos' || asset.muscle === activeMuscle
        const queryMatches = !normalizedQuery || searchableTextForBundledAsset(asset).includes(normalizedQuery)

        return muscleMatches && queryMatches
      }),
    [activeMuscle, normalizedQuery],
  )

  useEffect(() => setDraftSelection(selection), [selection])
  useEffect(() => setActiveMuscle(mainMuscle), [mainMuscle])

  return (
    <div className="fixed inset-y-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 items-end overflow-hidden bg-black/55" role="presentation">
      <button aria-label="Cerrar selector de imagen" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section
        aria-labelledby="exercise-image-selector-title"
        className="relative grid max-h-[78dvh] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]"
        role="dialog"
      >
        <header className="sticky top-0 z-10 min-w-0 border-b border-white/10 bg-arsen-bg2 px-3 pb-2 pt-3">
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/25" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black leading-tight" id="exercise-image-selector-title">
              Imagen del ejercicio
            </h2>
            <button aria-label="Cerrar" className="grid size-8 place-items-center rounded-[9px] text-arsen-muted" onClick={onClose} type="button">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <label className="mt-2 grid grid-cols-[28px_minmax(0,1fr)] items-center gap-1 rounded-[10px] border border-white/10 bg-arsen-surface px-2">
            <Search aria-hidden="true" className="size-4 text-arsen-muted" />
            <span className="sr-only">Buscar imagen</span>
            <input
              className="min-h-10 bg-transparent text-xs font-semibold outline-none placeholder:text-arsen-muted"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar imagen"
              type="search"
              value={query}
            />
          </label>
          <div className="scrollbar-none mt-2 flex min-w-0 gap-1.5 overflow-x-auto overflow-y-hidden pb-1">
            {(['Todos', ...muscleGroups] as const).map((muscle) => (
              <button
                aria-pressed={activeMuscle === muscle}
                className={[
                  'min-h-8 shrink-0 rounded-full border px-2.5 text-xs font-extrabold',
                  activeMuscle === muscle
                    ? 'border-arsen-purple2 bg-arsen-purple/25 text-arsen-ink'
                    : 'border-white/10 bg-arsen-surface text-arsen-muted',
                ].join(' ')}
                disabled={disabled}
                key={muscle}
                onClick={() => setActiveMuscle(muscle)}
                type="button"
              >
                {muscle}
              </button>
            ))}
          </div>
        </header>

        <div className="scrollbar-none min-w-0 overflow-y-auto overflow-x-hidden p-3">
          <label className="mb-2 grid min-h-10 cursor-pointer grid-cols-[30px_1fr] items-center gap-1.5 rounded-[10px] border border-white/10 bg-arsen-surface px-2.5 text-xs font-bold text-arsen-purple2">
            <ImagePlus aria-hidden="true" className="size-4" />
            <span>Subir imagen propia</span>
            <input
              aria-label="Subir imagen propia"
              accept="image/*"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onUpload(file)
              }}
              type="file"
            />
          </label>

          {assets.map((asset) => (
            <button
              className={[
                'mb-2 grid w-full grid-cols-[38px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border p-1.5 text-left',
                draftSelection.customAssetId === asset.id ? 'border-arsen-purple2 bg-arsen-purple/20' : 'border-white/10 bg-arsen-surface',
              ].join(' ')}
              aria-pressed={draftSelection.customAssetId === asset.id}
              disabled={disabled}
              key={asset.id}
              onClick={() => setDraftSelection({ bundledAssetId: null, customAssetId: asset.id })}
              type="button"
            >
              <ExerciseArt alt="" className="size-[38px]" customImageSrc={asset.dataUrl} />
              <span className="min-w-0 truncate text-xs font-extrabold">{asset.name}</span>
            </button>
          ))}

          <div className="grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5">
            {visibleBundledAssets.map((asset) => (
              <button
                className={[
                  'min-w-0 rounded-[8px] border p-1 text-center',
                  draftSelection.bundledAssetId === asset.id && !draftSelection.customAssetId
                    ? 'border-arsen-purple2 bg-arsen-purple/25 text-arsen-ink'
                    : 'border-white/10 bg-arsen-surface text-arsen-muted',
                ].join(' ')}
                aria-pressed={draftSelection.bundledAssetId === asset.id && !draftSelection.customAssetId}
                disabled={disabled}
                key={asset.id}
                onClick={() => setDraftSelection({ bundledAssetId: asset.id, customAssetId: null })}
                type="button"
              >
                <ExerciseArt alt="" bundledAssetId={asset.id} className="aspect-square w-full" muscle={asset.muscle} />
                <span className="mt-1 line-clamp-2 h-8 text-xs font-extrabold leading-tight">{asset.name}</span>
              </button>
            ))}
          </div>

          {visibleBundledAssets.length === 0 ? <p className="rounded-[10px] border border-white/10 bg-arsen-surface p-2 text-xs font-bold text-arsen-muted">Sin resultados</p> : null}
          {error ? (
            <p className="mt-3 text-xs font-bold text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="grid grid-cols-[38px_minmax(0,1fr)_104px] items-center gap-2 border-t border-white/10 bg-arsen-bg2 p-2">
          <ExerciseArt
            alt={selectedCustomAsset?.name ?? selectedBundledAsset?.name ?? 'Imagen seleccionada'}
            bundledAssetId={selectedBundledAsset?.id ?? null}
            className="size-[38px]"
            customImageSrc={selectedCustomAsset?.dataUrl ?? null}
            muscle={selectedBundledAsset?.muscle ?? mainMuscle}
          />
          <p className="min-w-0 truncate text-xs font-bold text-arsen-muted">{selectedCustomAsset?.name ?? selectedBundledAsset?.name ?? 'Auto'}</p>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-gradient-to-b from-arsen-acid to-arsen-acid2 px-3 text-xs font-extrabold text-[#142100] transition active:scale-[0.99] disabled:opacity-50"
            disabled={disabled}
            onClick={() => onChange(draftSelection)}
            type="button"
          >
            Usar imagen
          </button>
        </footer>
      </section>
    </div>
  )
}
