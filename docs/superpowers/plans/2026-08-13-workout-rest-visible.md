# Workout Rest Visible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the configured rest time for the current workout exercise in the main `/entreno` card.

**Architecture:** Add one shared formatter in `src/shared/utils/time.ts` with focused unit coverage. Consume it from `WorkoutPage` and `RoutineDayDetailPage` so rest display has one convention.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind v4.

## Global Constraints

- Offline only; no backend or network dependency.
- Read rest from the existing `RoutineExercise.restSeconds`.
- Show `—` for missing, zero, negative, or non-finite rest.
- Use Spanish display text: `seg`, `min`, `Descanso`.
- Preserve mobile-first layout down to 360 px.
- Do not implement a rest timer.
- Do not change Dexie schema or snapshots.

---

### Task 1: Shared Rest Formatter

**Files:**
- Create: `src/shared/utils/time.ts`
- Create: `src/shared/utils/time.test.ts`

**Interfaces:**
- Produces: `formatRestSeconds(seconds: number | null | undefined): string`

- [ ] **Step 1: Write the failing formatter test**

```ts
import { describe, expect, it } from 'vitest'
import { formatRestSeconds } from './time'

describe('time utils', () => {
  it('formats configured rest seconds for display', () => {
    expect(formatRestSeconds(45)).toBe('45 seg')
    expect(formatRestSeconds(60)).toBe('1:00 min')
    expect(formatRestSeconds(90)).toBe('1:30 min')
    expect(formatRestSeconds(125)).toBe('2:05 min')
  })

  it('shows a clear placeholder for missing or unset rest', () => {
    expect(formatRestSeconds(0)).toBe('—')
    expect(formatRestSeconds(undefined)).toBe('—')
    expect(formatRestSeconds(null)).toBe('—')
    expect(formatRestSeconds(Number.NaN)).toBe('—')
  })
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm test src/shared/utils/time.test.ts`
Expected: FAIL because `src/shared/utils/time.ts` does not exist.

- [ ] **Step 3: Implement the formatter**

```ts
export function formatRestSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return '—'

  const totalSeconds = Math.floor(seconds)
  if (totalSeconds < 60) return `${totalSeconds} seg`

  const minutes = Math.floor(totalSeconds / 60)
  const remainder = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainder} min`
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `pnpm test src/shared/utils/time.test.ts`
Expected: PASS.

### Task 2: Workout Card Rest Row

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `formatRestSeconds(seconds: number | null | undefined): string`

- [ ] **Step 1: Update the WorkoutPage test expectation**

```ts
expect(screen.getByText('Descanso')).toBeInTheDocument()
expect(screen.getByText('1:30 min')).toBeInTheDocument()
expect(screen.getByLabelText('Descanso recomendado')).toHaveTextContent('Descanso1:30 min')
```

- [ ] **Step 2: Run the focused UI test and confirm it fails**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`
Expected: FAIL because the current implementation does not expose a dedicated rest row.

- [ ] **Step 3: Import and render the rest row**

Add:

```ts
import { formatRestSeconds } from '../../../shared/utils/time'
```

Keep the metric grid to four existing values:

```tsx
<div className="grid grid-cols-4 gap-0 py-3 text-center">
```

Render rest as its own centered row below the metrics:

```tsx
<div aria-label="Descanso recomendado" className="border-t border-white/10 py-3 text-center text-xs">
  <span className="text-arsen-muted">Descanso</span>
  <strong className="ml-2 text-sm text-arsen-ink">{formatRestSeconds(currentExercise?.restSeconds)}</strong>
</div>
```

- [ ] **Step 4: Run the focused UI test and confirm it passes**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`
Expected: PASS.

### Task 3: Routine Detail Uses Same Formatter

**Files:**
- Modify: `src/domains/routine/pages/RoutineDayDetailPage.tsx`

**Interfaces:**
- Consumes: `formatRestSeconds(seconds: number | null | undefined): string`

- [ ] **Step 1: Import the formatter**

```ts
import { formatRestSeconds } from '../../../shared/utils/time'
```

- [ ] **Step 2: Replace inline rest display**

```tsx
<DetailMetric label="Descanso" value={formatRestSeconds(exercise.restSeconds)} />
```

- [ ] **Step 3: Run related tests**

Run: `pnpm test src/domains/routine/pages/RoutineDayDetailPage.test.tsx`
Expected: PASS.

### Task 4: Final Verification

- [ ] Run `node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src/domains/workout/pages/WorkoutPage.tsx src/domains/routine/pages/RoutineDayDetailPage.tsx`
- [ ] Run `pnpm test`
- [ ] Run `pnpm build`
- [ ] Review `git diff` for scope.

## Self-Review

- Spec coverage: formatter, placeholder, live source, mobile layout, and tests are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `formatRestSeconds(seconds: number | null | undefined): string` is consistent across all tasks.
