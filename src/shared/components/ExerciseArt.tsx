import { useEffect, useState } from 'react'
import { getBundledExerciseAsset, getMuscleAsset } from '../assets/exerciseImages'
import { readCatalogImage } from '../assets/catalogImages'
import { parseCatalogImageReference } from '../assets/catalogImageReference'

type ExerciseArtProps = {
  alt: string
  assetKind?: string | null
  bundledAssetId?: string | null
  className?: string
  customImageSrc?: string | null
  muscle?: string | null
}

const placeholderArt =
  'radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--color-arsen-purple) 30%, transparent), color-mix(in oklab, var(--color-arsen-ink) 4%, transparent) 42%, transparent 68%)'

export function ExerciseArt({ alt, assetKind, bundledAssetId, className = 'size-[66px]', customImageSrc, muscle }: ExerciseArtProps) {
  const [globalImage, setGlobalImage] = useState<{ reference: string; src: string } | null>(null)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setGlobalImage(null)
    const image = !customImageSrc ? parseCatalogImageReference(assetKind) : null
    if (image) {
      void readCatalogImage(image).then((blob) => {
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setGlobalImage({ reference: assetKind!, src: objectUrl })
      }).catch(() => undefined)
    }
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetKind, customImageSrc])
  const bundledAsset = getBundledExerciseAsset(bundledAssetId)
  const muscleSrc = getMuscleAsset(muscle)
  const resolvedImageSrc = customImageSrc || (globalImage && globalImage.reference === assetKind ? globalImage.src : null)
  const imageSource = resolvedImageSrc ? 'custom' : bundledAsset ? 'bundled' : muscleSrc ? 'muscle' : 'placeholder'
  const backgroundImage = resolvedImageSrc
    ? `url(${resolvedImageSrc})`
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
