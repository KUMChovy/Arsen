import exerciseSprite from '../../assets/arsen-exercise-sprite.png'
import muscleSprite from '../../assets/arsen-muscle-groups-sprite.png'
import type { MuscleGroup } from '../../domains/routine/types'
import { normalizeMuscleGroup } from '../../domains/routine/utils/muscles'

export type ExerciseArtKind = 'press' | 'pecDeck' | 'row' | 'hackSquat' | 'latPulldown' | 'shoulderPress'

type ExerciseArtProps = {
  alt: string
  assetKind?: string | null
  className?: string
  customImageSrc?: string | null
  muscle?: string | null
}

const positions: Record<ExerciseArtKind, string> = {
  press: '0% 50%',
  pecDeck: '20% 50%',
  row: '40% 50%',
  hackSquat: '60% 50%',
  latPulldown: '80% 50%',
  shoulderPress: '100% 50%',
}

const musclePositions: Record<MuscleGroup, string> = {
  Abdomen: '80% 50%',
  Brazos: '60% 50%',
  Espalda: '20% 50%',
  Hombros: '40% 50%',
  Pecho: '0% 50%',
  Piernas: '100% 50%',
}

function isExerciseArtKind(value: string | null | undefined): value is ExerciseArtKind {
  return typeof value === 'string' && Object.hasOwn(positions, value)
}

export function ExerciseArt({ alt, assetKind, className = 'size-[66px]', customImageSrc, muscle }: ExerciseArtProps) {
  const normalizedMuscle = muscle ? normalizeMuscleGroup(muscle) : null
  const resolvedKind = isExerciseArtKind(assetKind) ? assetKind : null
  const backgroundImage = customImageSrc
    ? `url(${customImageSrc})`
    : `url(${resolvedKind || !normalizedMuscle ? exerciseSprite : muscleSprite})`

  return (
    <div
      aria-label={alt}
      className={[
        'shrink-0 overflow-hidden rounded-[10px] border border-arsen-purple/40 bg-arsen-bg2 bg-no-repeat shadow-[inset_0_0_18px_rgb(153_83_255_/_0.18)]',
        className,
      ].join(' ')}
      role="img"
      style={{
        backgroundImage,
        backgroundPosition: customImageSrc ? 'center' : resolvedKind ? positions[resolvedKind] : normalizedMuscle ? musclePositions[normalizedMuscle] : positions.press,
        backgroundRepeat: 'no-repeat',
        backgroundSize: customImageSrc ? 'cover' : resolvedKind ? '600% 100%' : '640% 108%',
      }}
    />
  )
}
