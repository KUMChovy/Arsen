import type { PropsWithChildren } from 'react'
import { HeaderActions } from './HeaderActions'

type PageHeaderProps = PropsWithChildren<{
  eyebrow?: string
  title: string
  tourKey?: string
}>

export function PageHeader({ children, eyebrow, title, tourKey = 'page-header' }: PageHeaderProps) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-2" data-tour={tourKey}>
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-black leading-none tracking-normal">{title}</h1>
        {eyebrow ? <p className="mt-1 text-xs text-arsen-muted">{eyebrow}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}<HeaderActions /></div>
    </header>
  )
}
