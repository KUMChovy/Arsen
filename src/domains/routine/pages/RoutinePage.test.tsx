// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutinePage } from './RoutinePage'
import type { RoutineDay } from '../types'
import type { PublishedCatalog } from '../../../shared/validation/remoteCatalog'

const routinePageMocks = vi.hoisted(() => ({
  addCatalogExerciseToDay: vi.fn(() => Promise.resolve('exercise-1')),
  catalog: [] as RoutinePageCatalogItem[],
  globalCatalog: null as PublishedCatalog | null,
  createCatalogExercise: vi.fn(() => Promise.resolve('catalog-1')),
  createExerciseAsset: vi.fn(() => Promise.resolve('asset-uploaded')),
  createRoutine: vi.fn(() => Promise.resolve('routine-created')),
  createGuidedRoutine: vi.fn(() => Promise.resolve('routine-created')),
  setActiveRoutine: vi.fn(() => Promise.resolve()),
  bundle: null as RoutinePageBundle | null,
  routines: [] as RoutinePageRoutine[],
}))

vi.mock('../hooks', () => ({
  useActiveRoutineBundle: () => routinePageMocks.bundle,
  useExerciseAssets: () => [],
  useExerciseCatalog: () => routinePageMocks.catalog,
  useGlobalCatalog: () => routinePageMocks.globalCatalog,
  useRoutines: () => routinePageMocks.routines,
  useRoutineSummaries: () => routinePageMocks.routines.map((routine) => ({ routine, days: routinePageMocks.bundle?.routine.id === routine.id ? routinePageMocks.bundle.days : [], exerciseCount: routinePageMocks.bundle?.routine.id === routine.id ? [...routinePageMocks.bundle.exercisesByDay.values()].reduce((count, exercises) => count + exercises.length, 0) : 0 })),
}))

vi.mock('../../workout/hooks', () => ({
  useWeightIncreaseRecommendations: () => [],
}))

vi.mock('../../../shared/utils/alerts', () => ({ confirmAction: vi.fn(() => Promise.resolve(false)), confirmDanger: vi.fn(() => Promise.resolve(false)) }))

vi.mock('../services', () => ({
  addCatalogExerciseToDay: routinePageMocks.addCatalogExerciseToDay,
  createCatalogExercise: routinePageMocks.createCatalogExercise,
  createDay: vi.fn(),
  createExerciseAsset: routinePageMocks.createExerciseAsset,
  createRoutine: routinePageMocks.createRoutine,
  createGuidedRoutine: routinePageMocks.createGuidedRoutine,
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
    window.sessionStorage.clear()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    routinePageMocks.createCatalogExercise.mockResolvedValue('catalog-1')
    routinePageMocks.createExerciseAsset.mockResolvedValue('asset-uploaded')
    routinePageMocks.createRoutine.mockResolvedValue('routine-created')
    routinePageMocks.createGuidedRoutine.mockResolvedValue('routine-created')
    routinePageMocks.setActiveRoutine.mockResolvedValue(undefined)
    routinePageMocks.bundle = defaultBundle()
    routinePageMocks.catalog = []
    routinePageMocks.globalCatalog = null
    routinePageMocks.routines = [routine]
  })

  it('opens the wizard and creates a routine only after review', async () => {
    render(
      <MemoryRouter>
        <RoutinePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Crear rutina' })[1]!)
    expect(screen.getByRole('dialog', { name: 'Crear rutina' })).toBeInTheDocument()
    expect(routinePageMocks.createGuidedRoutine).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Fuerza' } })
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear rutina' }))
    await waitFor(() => {
      expect(routinePageMocks.createGuidedRoutine).toHaveBeenCalledWith({ name: 'Fuerza', days: [{ name: 'Día 1', exerciseIds: [] }] })
    })
  })

  it('lets a new user explore Sinful Shell without losing the unfinished wizard', () => {
    routinePageMocks.routines = []
    routinePageMocks.bundle = null
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear rutina' }).at(-1)!)
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Mi primera rutina' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Explorar Sinful Shell' }))
    expect(screen.getByRole('dialog', { name: 'Sinful Shell' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sinful Shell' }))
    expect(screen.getByRole('dialog', { name: 'Crear rutina' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByLabelText('Nombre de la rutina')).toHaveValue('Mi primera rutina')
  })
  it('keeps the catalog accessible when there is no routine', () => {
    routinePageMocks.routines = []
    routinePageMocks.bundle = null
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
    expect(screen.getByRole('button', { name: /Explorar Sinful Shell/i })).toBeInTheDocument()
  })
  it('switches the visible routine view when the tour highlights it', () => {
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent(window, new CustomEvent('arsen:tour-routine-mode', { detail: 'catalog' }))
    expect(screen.getByRole('button', { name: 'Catalogo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Explorar Sinful Shell/i })).toBeInTheDocument()
  })
  it('adds a Sinful Shell exercise to the catalog while creating the first routine', async () => {
    routinePageMocks.routines = []
    routinePageMocks.bundle = null
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear rutina' }).at(-1)!)
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Mi rutina' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Explorar Sinful Shell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Press inclinado Disponible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(routinePageMocks.createCatalogExercise).toHaveBeenCalledWith(expect.objectContaining({ mode: 'create-from-sinful-shell', sinfulShellId: 'sinful-shell-press-inclinado' })))
    expect(routinePageMocks.createGuidedRoutine).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: 'Crear rutina' })).toBeInTheDocument()
  })

  it('prevents repeated routine creation while the first operation is pending', async () => {
    const pending = deferred<string>()
    routinePageMocks.createGuidedRoutine.mockImplementationOnce(() => pending.promise)
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    const create = screen.getAllByRole('button', { name: 'Crear rutina' })[1]!
    fireEvent.click(create)
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Fuerza' } })
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear rutina' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(routinePageMocks.createGuidedRoutine).toHaveBeenCalledTimes(1)
    pending.resolve('routine-created')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('provides a separate keyboard-accessible drag handle for a day', () => {
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByText('Reordenar días'))
    expect(screen.getByRole('button', { name: 'Reordenar Dia 1' })).toBeInTheDocument()
  })

  it('shows compact day selection while keeping reordering in a disclosure', () => {
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('button', { name: 'Dia 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Reordenar días')).toBeInTheDocument()
  })

  it('identifies the active routine and summarizes its configured days', () => {
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByText('1 día · 0 ejercicios')).toBeInTheDocument()
  })

  it('expands an inactive routine and offers activation', () => {
    routinePageMocks.routines = [routine, { ...routine, id: 'routine-2', name: 'Movilidad', isActive: false }]
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Movilidad'))
    expect(screen.getByRole('button', { name: 'Activar Movilidad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Movilidad' })).toBeInTheDocument()
  })

  it('preserves unsaved day edits when switching days', () => {
    const second = { ...day, id: 'day-2', name: 'Dia 2' }
    routinePageMocks.bundle = { ...defaultBundle(), days: [day, second] }
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByText('Ajustes del día'))
    fireEvent.change(screen.getByLabelText('Nombre del dia'), { target: { value: 'Pendiente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dia 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dia 1' }))
    expect(screen.getByLabelText('Nombre del dia')).toHaveValue('Pendiente')
  })

  it('keeps a day draft when its settings are collapsed and reopened', () => {
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const disclosure = screen.getByText('Ajustes del día')
    fireEvent.click(disclosure)
    fireEvent.change(screen.getByLabelText('Nombre del dia'), { target: { value: 'Torso nuevo' } })
    fireEvent.click(disclosure)
    fireEvent.click(disclosure)
    expect(screen.getByLabelText('Nombre del dia')).toHaveValue('Torso nuevo')
  })

  it('keeps the routine name while its settings are collapsed', () => {
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const disclosure = screen.getByText('Ajustes de rutina')
    fireEvent.click(disclosure)
    fireEvent.change(screen.getByLabelText('Nombre de rutina'), { target: { value: 'Mi rutina nueva' } })
    fireEvent.click(disclosure)
    fireEvent.click(disclosure)
    expect(screen.getByLabelText('Nombre de rutina')).toHaveValue('Mi rutina nueva')
  })

  it('keeps advanced recipe settings after collapsing them', () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]
    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: /Press plano/ }))
    const disclosure = screen.getByText('Opciones avanzadas')
    fireEvent.click(disclosure)
    fireEvent.change(screen.getByLabelText('Notas tecnicas'), { target: { value: 'Controlar bajada' } })
    fireEvent.click(disclosure)
    fireEvent.click(disclosure)
    expect(screen.getByLabelText('Notas tecnicas')).toHaveValue('Controlar bajada')
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

  it('offers an action when the active routine has no days', () => {
    routinePageMocks.bundle = { ...defaultBundle(), days: [], exercisesByDay: new Map() }
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    expect(screen.getByText('Esta rutina aún no tiene días.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Organizar días' }))
    expect(screen.getByRole('button', { name: '+ Crear dia' })).toBeInTheDocument()
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

  it('uses the downloaded catalog count and opens a published remote exercise', () => {
    routinePageMocks.globalCatalog = { version: 5, exercises: [{
      id: 'sinful-shell-nuevo', name: 'Ejercicio nuevo', canonicalName: 'ejercicio-nuevo', mainMuscle: 'Pecho',
      aliases: [], technicalNotes: 'Indicaciones nuevas.',
      image: { url: 'https://assets.example.test/a.png', sha256: 'a'.repeat(64), sizeBytes: 100, mimeType: 'image/png' },
    }] }
    render(<MemoryRouter><RoutinePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
    expect(screen.getByText('1 ejercicio disponible')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Explorar Sinful Shell/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Ejercicio nuevo Disponible' }))
    expect(screen.getByText('Indicaciones nuevas.')).toBeInTheDocument()
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

  it('increments the planned sets with a touch control', () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]
    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: /Press plano/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar series' }))
    expect(screen.getByLabelText('Series')).toHaveValue(4)
  })

  it('keeps the recipe open and reports an error when persistence fails', async () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]
    routinePageMocks.addCatalogExerciseToDay.mockRejectedValueOnce(new Error('No se pudo guardar'))
    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: /Press plano/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar receta' }))
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Receta del dia' })).toBeInTheDocument()
  })

  it('does not discard a changed recipe when closing is cancelled', async () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]
    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: /Press plano/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar series' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1)!)
    await waitFor(() => expect(screen.getByLabelText('Series')).toHaveValue(4))
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

const day: RoutineDay = {
  createdAt: '2026-08-02T00:00:00.000Z',
  description: '',
  id: 'day-1',
  name: 'Dia 1',
  order: 0,
  routineId: 'routine-1',
  updatedAt: '2026-08-02T00:00:00.000Z',
  weekday: 1,
}

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
