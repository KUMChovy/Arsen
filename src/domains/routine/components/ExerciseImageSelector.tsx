import { ImagePlus, X } from 'lucide-react'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import type { ExerciseAsset, MuscleGroup } from '../types'

export type ExerciseImageSelection = {
  assetKind: string | null
  customAssetId: string | null
}

type ExerciseImageSelectorProps = {
  assets: ExerciseAsset[]
  disabled: boolean
  error: string | null
  mainMuscle: MuscleGroup
  onChange: (selection: ExerciseImageSelection) => void
  onUpload: (file: File) => void
  selection: ExerciseImageSelection
}

const includedOptions: Array<{ label: string; value: ExerciseArtKind | null }> = [
  { label: 'Auto', value: null },
  { label: 'Press', value: 'press' },
  { label: 'Pec deck', value: 'pecDeck' },
  { label: 'Remo', value: 'row' },
  { label: 'Hack', value: 'hackSquat' },
  { label: 'Jalon', value: 'latPulldown' },
  { label: 'Hombro', value: 'shoulderPress' },
]

export function ExerciseImageSelector({ assets, disabled, error, mainMuscle, onChange, onUpload, selection }: ExerciseImageSelectorProps) {
  return (
    <section className="space-y-2 rounded-[12px] border border-white/10 bg-arsen-bg/45 p-3">
      <div>
        <div className="text-xs font-extrabold text-arsen-muted">Imagen</div>
        <p className="mt-1 text-xs font-semibold text-arsen-muted">Recomendado: 512 x 512 px, sujeto centrado y margen de 48-64 px.</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {includedOptions.map((option) => (
          <button
            className={[
              'min-w-0 rounded-[10px] border p-1.5 text-xs font-bold',
              selection.assetKind === option.value && !selection.customAssetId
                ? 'border-arsen-purple2 bg-arsen-purple/30 text-arsen-ink'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            aria-pressed={selection.assetKind === option.value && !selection.customAssetId}
            disabled={disabled}
            key={option.label}
            onClick={() => onChange({ assetKind: option.value, customAssetId: null })}
            type="button"
          >
            <ExerciseArt alt={option.label} assetKind={option.value} className="mx-auto size-11" muscle={mainMuscle} />
            <span className="mt-1 block truncate">{option.label}</span>
          </button>
        ))}
      </div>
      <label className="grid min-h-12 cursor-pointer grid-cols-[36px_1fr] items-center gap-2 rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-bold text-arsen-purple2">
        <ImagePlus aria-hidden="true" className="size-5" />
        <span>Subir imagen propia</span>
        <input
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
            'grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 rounded-[10px] border p-2 text-left',
            selection.customAssetId === asset.id ? 'border-arsen-purple2 bg-arsen-purple/20' : 'border-white/10 bg-arsen-surface',
          ].join(' ')}
          aria-pressed={selection.customAssetId === asset.id}
          disabled={disabled}
          key={asset.id}
          onClick={() => onChange({ assetKind: selection.assetKind, customAssetId: asset.id })}
          type="button"
        >
          <ExerciseArt alt={asset.name} className="size-[52px]" customImageSrc={asset.dataUrl} />
          <span className="min-w-0 truncate text-sm font-extrabold">{asset.name}</span>
          <span className="text-xs font-bold text-arsen-purple2">Usar</span>
        </button>
      ))}
      {selection.customAssetId ? (
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-white/10 px-3 text-xs font-extrabold text-arsen-muted"
          disabled={disabled}
          onClick={() => onChange({ assetKind: selection.assetKind, customAssetId: null })}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
          Quitar imagen propia
        </button>
      ) : null}
      {error ? <p className="text-xs font-bold text-red-300" role="alert">{error}</p> : null}
    </section>
  )
}
