# Crear Rutina Visible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Crear rutina` visible on `/rutina` while preserving the existing overflow-menu action.

**Architecture:** Keep the creation flow in `RoutinePage` and reuse `createRoutine` plus `setActiveRoutine`. Add small presentational UI only in the routine page and keep tests at the page-component boundary.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest, Testing Library.

## Global Constraints

- UI strings stay in Spanish.
- Do not change Dexie schema, routing, routine services, import/export behavior, or activation semantics.
- Keep `Crear rutina` inside the three-dot menu.
- Mobile-first target must work down to 360px.

---

### Task 1: Visible Create Routine UI

**Files:**
- Modify: `src/domains/routine/pages/RoutinePage.tsx`
- Test: `src/domains/routine/pages/RoutinePage.test.tsx`

**Interfaces:**
- Consumes: `createRoutine(name: string): Promise<string>`, `setActiveRoutine(routineId: string): Promise<void>`, `ActionButton`
- Produces: visible button named `Crear rutina` and empty-state button named `Crear rutina`

- [ ] **Step 1: Add failing tests**

```tsx
it('creates and activates a routine from the visible action', async () => {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getAllByRole('button', { name: 'Crear rutina' })[0]!)

  await waitFor(() => {
    expect(routinePageMocks.createRoutine).toHaveBeenCalledWith('Nueva rutina')
    expect(routinePageMocks.setActiveRoutine).toHaveBeenCalledWith('routine-created')
  })
})
```

```tsx
it('guides empty routine state to create a new routine', () => {
  routinePageMocks.bundle = null
  routinePageMocks.routines = []

  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  expect(screen.getByText('Crea tu primera rutina')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Crear rutina' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`

Expected: visible create or empty-state assertions fail before implementation.

- [ ] **Step 3: Implement minimal UI**

```tsx
function createAndActivateRoutine() {
  runRoutineAction(async () => {
    const routineId = await createRoutine('Nueva rutina')
    await setActiveRoutine(routineId)
    return routineId
  }, 'Rutina creada y activada')
}
```

Use that handler for the visible `ActionButton`, empty state, and existing menu item.

- [ ] **Step 4: Run focused tests**

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`

Expected: all tests in the file pass.

- [ ] **Step 5: Run UI detector and production checks**

Run:

```powershell
node C:/Users/Chovy/.agents/skills/impeccable/scripts/detect.mjs --json src/domains/routine/pages/RoutinePage.tsx
pnpm test
pnpm build
```

Expected: detector has no blocking findings, tests pass, build passes.

## Self-Review

- Spec coverage: visible action, menu fallback, active routine flow, empty state, and mobile comfort are covered by Task 1.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: uses existing service names and page test patterns.
