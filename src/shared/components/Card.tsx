import type { PropsWithChildren } from 'react'

type CardProps = PropsWithChildren<{
  className?: string
}>

export function Card({ children, className = '' }: CardProps) {
  return (
    <section
      className={[
        'rounded-xl border border-white/10 bg-arsen-surface shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]',
        className,
      ].join(' ')}
    >
      {children}
    </section>
  )
}
