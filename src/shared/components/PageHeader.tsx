import type { PropsWithChildren } from 'react'

type PageHeaderProps = PropsWithChildren<{
  eyebrow?: string
  title: string
}>

export function PageHeader({ children, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-black leading-none tracking-normal">{title}</h1>
        {eyebrow ? <p className="mt-1 text-xs text-arsen-muted">{eyebrow}</p> : null}
      </div>
      {children}
    </header>
  )
}
