import { getBundledExerciseAsset, getMuscleAsset } from '../assets/exerciseImages'

type ExerciseArtProps = {
  alt: string
  bundledAssetId?: string | null
  className?: string
  customImageSrc?: string | null
  muscle?: string | null
}

const placeholderArt =
  'radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--color-arsen-purple) 30%, transparent), color-mix(in oklab, var(--color-arsen-ink) 4%, transparent) 42%, transparent 68%)'

export function ExerciseArt({ alt, bundledAssetId, className = 'size-[66px]', customImageSrc, muscle }: ExerciseArtProps) {
  const bundledAsset = getBundledExerciseAsset(bundledAssetId)
  const muscleSrc = getMuscleAsset(muscle)
  const imageSource = customImageSrc ? 'custom' : bundledAsset ? 'bundled' : muscleSrc ? 'muscle' : 'placeholder'
  const backgroundImage = customImageSrc
    ? `url(${customImageSrc})`
    : bundledAsset
      ? `url(${bundledAsset.url})`
      : muscleSrc
        ? `url(${muscleSrc})`
        : placeholderArt

  return (
    <div
      aria-label={alt}
      className={[
        'shrink-0 overflow-hidden rounded-[10px] border border-arsen-purple/40 bg-arsen-bg2 bg-no-repeat shadow-inner shadow-arsen-purple/10',
        className,
      ].join(' ')}
      data-image-source={imageSource}
      role="img"
      style={{
        backgroundImage,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: imageSource === 'placeholder' ? '100% 100%' : 'cover',
      }}
    />
  )
}
