import { createContext, useContext, type ReactNode } from 'react'

export const HeaderActionsContext = createContext<ReactNode>(null)
export function HeaderActions() { return useContext(HeaderActionsContext) }
