import exerciseSprite from '../../assets/arsen-exercise-sprite.png'

export type ExerciseArtKind = 'press' | 'pecDeck' | 'row' | 'hackSquat' | 'latPulldown' | 'shoulderPress'

type ExerciseArtProps = {
  alt: string
  kind: ExerciseArtKind
  className?: string
}

const positions: Record<ExerciseArtKind, string> = {
  press: '0% 50%',
  pecDeck: '20% 50%',
  row: '40% 50%',
  hackSquat: '60% 50%',
  latPulldown: '80% 50%',
  shoulderPress: '100% 50%',
}

export function ExerciseArt({ alt, className = '', kind }: ExerciseArtProps) {
  return (
    <div
      aria-label={alt}
      className={[
        'size-[66px] shrink-0 rounded-[10px] border border-arsen-purple/40 bg-arsen-bg2 shadow-[inset_0_0_18px_rgb(153_83_255_/_0.18)]',
        className,
      ].join(' ')}
      role="img"
      style={{
        backgroundImage: `url(${exerciseSprite})`,
        backgroundPosition: positions[kind],
        backgroundRepeat: 'no-repeat',
        backgroundSize: '600% 100%',
      }}
    />
  )
}
