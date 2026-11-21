import type { LucideIcon } from 'lucide-react'
import { CalendarDays, ChartColumnIncreasing, Dumbbell, History, Settings } from 'lucide-react'

export type NavItem = {
  label: string
  path: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: 'Entreno', path: '/', icon: Dumbbell },
  { label: 'Rutina', path: '/rutina', icon: CalendarDays },
  { label: 'Progreso', path: '/progreso', icon: ChartColumnIncreasing },
  { label: 'Historial', path: '/historial', icon: History },
  { label: 'Ajustes', path: '/settings', icon: Settings },
]
