# Workout Exercise Set Fusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionar "Ejercicios del dia" y "Series registradas" para que cada ejercicio despliegue sus series del dia con editar/eliminar desde su card.

**Architecture:** Mantener la logica en `WorkoutPage.tsx` porque los datos, filtros y acciones ya viven ahi. Reutilizar `EditSetSheet`, `deleteMainSet`, `updateMainSet` y los rows existentes de series, moviendo su render al contexto del ejercicio activo sin cambiar servicios ni repositorios.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest, Testing Library, lucide-react.

## Global Constraints

- No crear backend ni cambiar IndexedDB.
- No agregar dependencias.
- UI en espanol es-MX y mobile-first hasta 360px.
- Usar componentes y tokens existentes (`Card`, `ActionButton`, `arsen-*`).
- No hacer commit, branch, push ni merge sin confirmacion humana.
- Verificar con `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx` y `pnpm build`.

---

### Task 1: Tests de lista fusionada

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `WorkoutPage`, mocks de `useWorkoutProgress`, `updateMainSet`, `deleteMainSet`.
- Produces: pruebas que fallan si las series no viven dentro del ejercicio activo o si editar/eliminar no funcionan desde ese contexto.

- [ ] **Step 1: Expandir fixture a dos ejercicios**

Agregar `otherExercise`, `otherExerciseLog` y `otherSetLog`. Hacer que los hooks mock regresen ambos ejercicios y ambos logs.

```ts
const otherExercise: RoutineExercise = {
  ...exercise,
  canonicalName: 'remo-t',
  id: 'exercise-2',
  mainMuscle: 'Espalda',
  name: 'Remo T',
  order: 1,
}
```

- [ ] **Step 2: Escribir test de despliegue y filtro por ejercicio activo**

```ts
it('shows registered sets inside the selected exercise only', () => {
  render(<WorkoutPage />)

  fireEvent.click(screen.getByRole('button', { name: /Ver series de Press inclinado/i }))

  expect(screen.getByText('Serie 1 - 60 kg - 8 reps - RIR 1')).toBeInTheDocument()
  expect(screen.queryByText('Serie 1 - 80 kg - 6 reps - RIR 2')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Ver series de Remo T/i }))

  expect(screen.getByText('Serie 1 - 80 kg - 6 reps - RIR 2')).toBeInTheDocument()
  expect(screen.queryByText('Serie 1 - 60 kg - 8 reps - RIR 1')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Escribir test de editar desde ejercicio activo**

```ts
it('edits a set from the active exercise context', async () => {
  render(<WorkoutPage />)

  fireEvent.click(screen.getByRole('button', { name: /Ver series de Press inclinado/i }))
  fireEvent.click(screen.getByRole('button', { name: /Editar serie 1 de Press inclinado/i }))
  fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }))

  await waitFor(() => {
    expect(updateMainSet).toHaveBeenCalledWith('set-1', expect.objectContaining({ reps: 8, rir: 1, weightKg: 60 }))
  })
})
```

- [ ] **Step 4: Escribir test de eliminar desde ejercicio activo**

```ts
it('deletes a set from the active exercise context', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<WorkoutPage />)

  fireEvent.click(screen.getByRole('button', { name: /Ver series de Press inclinado/i }))
  fireEvent.click(screen.getByRole('button', { name: /Eliminar serie 1 de Press inclinado/i }))

  await waitFor(() => {
    expect(deleteMainSet).toHaveBeenCalledWith('set-1')
  })
})
```

- [ ] **Step 5: Ejecutar test para verificar fallo inicial**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL porque los botones `Ver series de ...` y las acciones contextuales aun no existen.

### Task 2: Implementar render fusionado

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`

**Interfaces:**
- Consumes: `dailyProgress.exerciseLogByExerciseId`, `dailyProgress.setLogs`, `dailyProgress.dropSets`, `selectedExerciseId`, `currentExerciseId`.
- Produces: seccion unica "Ejercicios y series del dia" y helper local para rows de series por ejercicio.

- [ ] **Step 1: Cambiar seleccion de ejercicio**

Agregar helper local:

```ts
function activateExercise(exerciseId: string) {
  setCurrentExerciseId(exerciseId)
  setSelectedExerciseId((current) => (current === exerciseId ? null : exerciseId))
}
```

- [ ] **Step 2: Derivar rows por ejercicio**

Agregar helper local dentro de `WorkoutPage`:

```ts
function rowsForExercise(exercise: RoutineExercise) {
  const log = dailyProgress.exerciseLogByExerciseId.get(exercise.id)
  if (!log) return []

  return dailyProgress.setLogs
    .filter((set) => set.kind === 'main' && set.exerciseLogId === log.id)
    .sort((a, b) => a.order - b.order)
    .map((set) => ({
      dropSets: dailyProgress.dropSets.filter((dropSet) => dropSet.setLogId === set.id).sort((a, b) => a.order - b.order),
      set,
    }))
}
```

- [ ] **Step 3: Quitar seccion global primaria de "Series registradas"**

Eliminar el render global de `loggedSetRows.map(...)`. Mantener el resumen diario de conteos intacto.

- [ ] **Step 4: Renombrar seccion y expandir card activo**

Cambiar encabezado a "Ejercicios y series del dia". En cada card, usar `activateExercise(exercise.id)` al tocar. Si `selectedExerciseId === exercise.id`, renderizar debajo los rows de `rowsForExercise(exercise)`.

- [ ] **Step 5: Reutilizar acciones de editar/eliminar**

Dentro de cada row:

```tsx
<button
  aria-label={`Editar serie ${set.order + 1} de ${exercise.name}`}
  disabled={isPending}
  onClick={() => setEditingSet({ exercise, set })}
  type="button"
>
  <Pencil aria-hidden="true" className="size-4" />
</button>
<button
  aria-label={`Eliminar serie ${set.order + 1} de ${exercise.name}`}
  disabled={isPending}
  onClick={() => deleteSet(set)}
  type="button"
>
  <Trash2 aria-hidden="true" className="size-4" />
</button>
```

- [ ] **Step 6: Ejecutar test especifico**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

### Task 3: Verificacion final UI/compilacion

**Files:**
- Verify: `src/domains/workout/pages/WorkoutPage.tsx`
- Verify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes: implementacion final.
- Produces: evidencia fresca antes de reportar.

- [ ] **Step 1: Detector Impeccable**

Run: `node C:\Users\Chovy\.agents\skills\impeccable\scripts/detect.mjs --json src/domains/workout/pages/WorkoutPage.tsx`

Expected: Sin findings bloqueantes; corregir findings aplicables.

- [ ] **Step 2: Tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 4: Revisar git diff**

Run: `git diff -- src/domains/workout/pages/WorkoutPage.tsx src/domains/workout/pages/WorkoutPage.test.tsx docs/superpowers/specs/2026-08-03-workout-exercise-set-fusion-design.md docs/superpowers/plans/2026-08-03-workout-exercise-set-fusion.md`

Expected: Solo cambios de spec, plan, UI fusionada y tests.
