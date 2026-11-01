// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HealthSetupWizard } from './HealthSetupWizard'

const baseProps = {
  busyAction: null,
  healthEnabled: false,
  onActivate: vi.fn(),
  onOpenAccess: vi.fn(),
  permissionsGranted: 0,
}

describe('HealthSetupWizard', () => {
  afterEach(cleanup)

  it('explains the third-party app chain and keeps Arsen separate from the watch', () => {
    render(<HealthSetupWizard {...baseProps} availability="available" />)

    expect(screen.getByText('Integración de salud')).toBeInTheDocument()
    expect(screen.getByText(/Mi Fitness/i)).toBeInTheDocument()
    expect(screen.getByText(/Samsung Health/i)).toBeInTheDocument()
    expect(screen.getByText(/No se conecta al reloj directamente/i)).toBeInTheDocument()
  })

  it('keeps activation as the only setup action when Health Connect is unavailable', () => {
    render(<HealthSetupWizard {...baseProps} availability="unavailable" />)

    expect(screen.getByText(/Health Connect no está instalado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activar integración' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Instalar Health Connect/i })).not.toBeInTheDocument()
  })

  it('offers access review after Health Connect is available', () => {
    render(<HealthSetupWizard {...baseProps} availability="available" healthEnabled permissionsGranted={2} />)

    expect(screen.getByText(/2 de 4 permisos/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gestionar permisos en Health Connect' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar lectura en Arsen' })).not.toBeInTheDocument()
  })

  it('keeps the setup panel collapsible and moves freshness details into its menu', () => {
    render(<HealthSetupWizard {...baseProps} availability="available" />)

    expect(screen.queryByRole('menu', { name: 'Disponibilidad de datos' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Información sobre disponibilidad' }))
    expect(screen.getByRole('menu', { name: 'Disponibilidad de datos' })).toHaveTextContent(/30 minutos/i)

    fireEvent.click(screen.getByRole('button', { name: 'Contraer integración de salud' }))
    expect(screen.getByRole('button', { name: 'Expandir integración de salud' })).toBeInTheDocument()
    expect(screen.queryByText('Permisos de lectura')).not.toBeInTheDocument()
  })
})
