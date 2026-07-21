import exerciseSprite from '../../assets/arsen-exercise-sprite.png'
import muscleSprite from '../../assets/arsen-muscle-groups-sprite.png'
import type { MuscleGroup } from '../../domains/routine/types'
import { normalizeMuscleGroup } from '../../domains/routine/utils/muscles'

export type ExerciseArtKind = 'press' | 'pecDeck' | 'row' | 'hackSquat' | 'latPulldown' | 'shoulderPress'

type ExerciseArtProps = {
  alt: string
  kind?: ExerciseArtKind
  className?: string
  muscle?: string
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

export function ExerciseArt({ alt, className = '', kind = 'press', muscle }: ExerciseArtProps) {
  const normalizedMuscle = muscle ? normalizeMuscleGroup(muscle) : null

  return (
    <div
      aria-label={alt}
      className={[
        'size-[66px] shrink-0 rounded-[10px] border border-arsen-purple/40 bg-arsen-bg2 shadow-[inset_0_0_18px_rgb(153_83_255_/_0.18)]',
        className,
      ].join(' ')}
      role="img"
      style={{
        backgroundImage: `url(${normalizedMuscle ? muscleSprite : exerciseSprite})`,
        backgroundPosition: normalizedMuscle ? musclePositions[normalizedMuscle] : positions[kind],
        backgroundRepeat: 'no-repeat',
        backgroundSize: normalizedMuscle ? '640% 108%' : '600% 100%',
      }}
    />
  )
}
