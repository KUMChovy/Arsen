import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ActionButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'acid' | 'ghost' | 'danger'
}>

const toneClasses = {
  primary: 'bg-gradient-to-b from-arsen-purple2 to-arsen-purple text-white',
  acid: 'bg-gradient-to-b from-arsen-acid to-arsen-acid2 text-[#142100]',
  ghost: 'border border-white/10 bg-transparent text-arsen-ink',
  danger: 'border border-red-400/40 bg-red-500/10 text-red-300',
}

export function ActionButton({ children, className = '', tone = 'primary', ...props }: ActionButtonProps) {
  return (
    <button
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-extrabold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        toneClasses[tone],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
