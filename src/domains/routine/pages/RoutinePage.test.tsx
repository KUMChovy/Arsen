// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutinePage } from './RoutinePage'

const routinePageMocks = vi.hoisted(() => ({
  addCatalogExerciseToDay: vi.fn(() => Promise.resolve('exercise-1')),
  catalog: [] as RoutinePageCatalogItem[],
  createCatalogExercise: vi.fn(() => Promise.resolve('catalog-1')),
  createExerciseAsset: vi.fn(() => Promise.resolve('asset-uploaded')),
  createRoutine: vi.fn(() => Promise.resolve('routine-created')),
  setActiveRoutine: vi.fn(() => Promise.resolve()),
  bundle: null as RoutinePageBundle | null,
  routines: [] as RoutinePageRoutine[],
}))

vi.mock('../hooks', () => ({
  useActiveRoutineBundle: () => routinePageMocks.bundle,
  useExerciseAssets: () => [],
  useExerciseCatalog: () => routinePageMocks.catalog,
  useRoutines: () => routinePageMocks.routines,
}))

vi.mock('../../workout/hooks', () => ({
  useWeightIncreaseRecommendations: () => [],
}))

vi.mock('../services', () => ({
  addCatalogExerciseToDay: routinePageMocks.addCatalogExerciseToDay,
  createCatalogExercise: routinePageMocks.createCatalogExercise,
  createDay: vi.fn(),
  createExerciseAsset: routinePageMocks.createExerciseAsset,
  createRoutine: routinePageMocks.createRoutine,
  deleteCatalogExercise: vi.fn(),
  deleteDay: vi.fn(),
  deleteExercise: vi.fn(),
  deleteRoutine: vi.fn(),
  duplicateDay: vi.fn(),
  duplicateExercise: vi.fn(),
  duplicateRoutine: vi.fn(),
  renameRoutine: vi.fn(),
  reorderDays: vi.fn(),
  reorderExercises: vi.fn(),
  setActiveRoutine: routinePageMocks.setActiveRoutine,
  updateCatalogExercise: vi.fn(),
  updateDay: vi.fn(),
  updateExercise: vi.fn(),
}))

describe('RoutinePage catalog image upload', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    routinePageMocks.createCatalogExercise.mockResolvedValue('catalog-1')
    routinePageMocks.createExerciseAsset.mockResolvedValue('asset-uploaded')
    routinePageMocks.createRoutine.mockResolvedValue('routine-created')
    routinePageMocks.setActiveRoutine.mockResolvedValue(undefined)
    routinePageMocks.bundle = defaultBundle()
    routinePageMocks.catalog = []
    routinePageMocks.routines = [routine]
  })

  it('creates and activates a routine from the visible action', async () => {
    render(
      <MemoryRouter>
        <RoutinePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Crear rutina' })[1]!)

    await waitFor(() => {
      expect(routinePageMocks.createRoutine).toHaveBeenCalledWith('Nueva rutina')
      expect(routinePageMocks.setActiveRoutine).toHaveBeenCalledWith('routine-created')
    })
  })

  it('guides empty routine state to create a new routine', () => {
    routinePageMocks.bundle = null
    routinePageMocks.routines = []

    render(
      <MemoryRouter>
        <RoutinePage />
      </MemoryRouter>,
    )

    const emptyState = screen.getByText('Crea tu primera rutina').closest('section')

    expect(emptyState).not.toBeNull()
    expect(within(emptyState!).getByRole('button', { name: 'Crear rutina' })).toBeInTheDocument()
  })

  it('rejects a non-image file without creating an asset', () => {
    const upload = openCatalogEditor()

    fireEvent.change(upload, { target: { files: [new File(['not an image'], 'notas.txt', { type: 'text/plain' })] } })

    expect(screen.getByText('Sube un archivo de imagen.')).toBeInTheDocument()
    expect(routinePageMocks.createExerciseAsset).not.toHaveBeenCalled()
  })

  it('rejects an image larger than 2 MB without creating an asset', () => {
    const upload = openCatalogEditor()
    const oversizedImage = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })

    fireEvent.change(upload, { target: { files: [oversizedImage] } })

    expect(screen.getByText('Usa una imagen de hasta 2 MB.')).toBeInTheDocument()
    expect(routinePageMocks.createExerciseAsset).not.toHaveBeenCalled()
  })

  it('selects the created asset and persists its ID when saving the catalog item', async () => {
    const upload = openCatalogEditor()

    fireEvent.change(upload, { target: { files: [new File(['image-data'], 'press.png', { type: 'image/png' })] } })

    await waitFor(() => {
      expect(routinePageMocks.createExerciseAsset).toHaveBeenCalledWith({
        dataUrl: 'data:image/png;base64,aW1hZ2UtZGF0YQ==',
        mimeType: 'image/png',
        name: 'press.png',
      })
    })
    expect(screen.getByRole('button', { name: 'Usar imagen' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(routinePageMocks.createCatalogExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          assetKind: null,
          bundledAssetId: null,
          customAssetId: 'asset-uploaded',
        }),
      )
    })
  })

  it('opens image options in a sheet and blocks saving while upload is pending', async () => {
    const uploadResult = deferred<string>()
    routinePageMocks.createExerciseAsset.mockImplementationOnce(() => uploadResult.promise)
    const upload = openCatalogEditor()

    fireEvent.change(upload, { target: { files: [new File(['first'], 'first.png', { type: 'image/png' })] } })

    await waitFor(() => {
      expect(routinePageMocks.createExerciseAsset).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Press inclinado$/ })).toBeDisabled()

    uploadResult.resolve('asset-new')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(routinePageMocks.createCatalogExercise).toHaveBeenCalledWith(
        expect.objectContaining({ customAssetId: 'asset-new' }),
      )
    })
  })

  it('opens Sinful Shell from the catalog banner and opens detail before finalization', () => {
    render(
      <MemoryRouter>
        <RoutinePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
    fireEvent.click(screen.getByRole('button', { name: /Explorar Sinful Shell/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Press inclinado Disponible' }))

    expect(screen.getByRole('heading', { name: 'Press inclinado' })).toBeInTheDocument()
    expect(routinePageMocks.createCatalogExercise).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))

    expect(screen.getByRole('heading', { name: 'Agregar a mi catalogo' })).toBeInTheDocument()
    expect(screen.getByText('Pecho')).toBeInTheDocument()
    expect(screen.getByText(/M.sculo principal: pectoral superior/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Equipo')).toBeInTheDocument()
    expect(screen.getByDisplayValue('press inclinado con barra, press de banca inclinado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Musculo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Imagen del ejercicio/i })).not.toBeInTheDocument()
  })

  it('saves a Sinful Shell copy through create-from-sinful-shell mode', async () => {
    render(
      <MemoryRouter>
        <RoutinePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
    fireEvent.click(screen.getByRole('button', { name: /Explorar Sinful Shell/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Press inclinado Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(routinePageMocks.createCatalogExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'create-from-sinful-shell',
          sinfulShellId: 'sinful-shell-press-inclinado',
        }),
      )
    })
  })

  it('opens Sinful Shell from the add exercise sheet', () => {
    render(
      <MemoryRouter>
        <RoutinePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Ejercicio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar desde Sinful Shell' }))

    expect(screen.getByRole('heading', { name: 'Sinful Shell' })).toBeInTheDocument()
  })
  it('shows muscle filters with Todos selected when adding an exercise', () => {
    routinePageMocks.catalog = [
      catalogItem('press', 'Press plano', 'Pecho'),
      catalogItem('remo', 'Remo T', 'Espalda'),
    ]

    openAddExercisePicker()

    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Pecho' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('2 ejercicios')).toBeInTheDocument()
  })

  it('filters picker results by muscle chip', () => {
    routinePageMocks.catalog = [
      catalogItem('press', 'Press plano', 'Pecho'),
      catalogItem('remo', 'Remo T', 'Espalda'),
    ]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }))

    expect(screen.queryByRole('button', { name: /Press plano/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remo T/ })).toBeInTheDocument()
    expect(screen.getByText('1 ejercicio')).toBeInTheDocument()
  })

  it('combines picker search with the selected muscle', () => {
    routinePageMocks.catalog = [
      catalogItem('press', 'Press plano', 'Pecho', ['banca']),
      catalogItem('fondos', 'Fondos', 'Brazos', ['banca']),
    ]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: 'Pecho' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar ejercicio'), { target: { value: 'BANCA' } })

    expect(screen.getByRole('button', { name: /Press plano/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Fondos/ })).not.toBeInTheDocument()
  })

  it('shows an empty state and clears picker filters', () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar ejercicio'), { target: { value: 'remo' } })

    expect(screen.getByText('No hay ejercicios de Espalda que coincidan con "remo".')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText('Buscar ejercicio')).toHaveValue('')
    expect(screen.getByRole('button', { name: /Press plano/ })).toBeInTheDocument()
  })

  it('keeps opening the recipe sheet after selecting a filtered exercise', () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: /Press plano/ }))

    expect(screen.getByRole('heading', { name: 'Receta del dia' })).toBeInTheDocument()
    expect(screen.getByText('Press plano')).toBeInTheDocument()
  })
})


function openAddExercisePicker() {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: '+ Ejercicio' }))
}

function openCatalogEditor() {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear ejercicio de catalogo' }))
  fireEvent.click(screen.getByRole('button', { name: /Imagen del ejercicio/i }))

  return screen.getByLabelText('Subir imagen propia')
}


function catalogItem(id: string, name: string, mainMuscle: string, aliases: string[] = []): RoutinePageCatalogItem {
  return {
    aliases,
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: id,
    createdAt: '2026-08-11T00:00:00.000Z',
    customAssetId: null,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id,
    loadMode: 'single',
    mainMuscle,
    name,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
  }
}

const day = {
  createdAt: '2026-08-02T00:00:00.000Z',
  description: '',
  id: 'day-1',
  name: 'Dia 1',
  order: 0,
  routineId: 'routine-1',
  updatedAt: '2026-08-02T00:00:00.000Z',
  weekday: 1,
} as const

const routine = {
  createdAt: '2026-08-02T00:00:00.000Z',
  id: 'routine-1',
  isActive: true,
  name: 'Mi rutina actual',
  updatedAt: '2026-08-02T00:00:00.000Z',
}

type RoutinePageRoutine = typeof routine
type RoutinePageCatalogItem = {
  aliases: string[]
  assetKind: string | null
  barWeightKg: number
  bundledAssetId: string | null
  canonicalName: string
  createdAt: string
  customAssetId: string | null
  defaultRecommendedRir: number
  defaultRepsMax: number
  defaultRepsMin: number
  defaultRestSeconds: number
  defaultTargetSets: number
  equipment: 'Barra'
  id: string
  loadMode: 'single'
  mainMuscle: string
  name: string
  origin?: 'user' | 'sinful-shell'
  sinfulShellContentLocked?: boolean
  sinfulShellId?: string | null
  technicalNotes: string
  updatedAt: string
  warmupProtocol: string
}
type RoutinePageBundle = ReturnType<typeof defaultBundle>

function defaultBundle() {
  return {
    days: [day],
    exercisesByDay: new Map([[day.id, []]]),
    routine,
    settings: { preferredUnit: 'kg' },
    volumeTargets: [],
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}
