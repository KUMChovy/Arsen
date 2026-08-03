# Crear Rutina Visible Design

## Job and audience

Users reach `/rutina` on a phone to manage routines between workouts. The current create flow exists, but hiding it behind the three-dot menu makes routine setup feel harder than it is.

## Outcome

`Crear rutina` must be visible on `/rutina` without depending only on the overflow menu. The created routine must keep using the existing flow: create `Nueva rutina`, then activate it with `setActiveRoutine`.

## Direction

- Add a visible, touch-friendly `Crear rutina` action below the page header using the existing `ActionButton` and `PlusCircle` icon.
- Keep `Crear rutina` inside the three-dot menu because the user explicitly wants that fallback to remain.
- Avoid confusing duplication by making the visible button the primary CTA and leaving the menu as secondary overflow alongside import/export.
- When there are no routines, replace the misleading loading-style routine view with an empty state that guides the user to create their first routine.

## Scope and boundaries

- Modify only `/rutina` UI in `src/domains/routine/pages/RoutinePage.tsx`.
- Do not change Dexie schema, routine services, import/export behavior, routing, or activation semantics.
- Keep Spanish UI copy and the existing dark mobile-first Arsen visual system.

## States and verification

- Normal state: visible `Crear rutina` creates and activates a routine.
- Empty state: no routines shows guidance and the same create action.
- Pending state: visible and menu create actions are disabled while an action is pending.
- Regression coverage: component test verifies visible creation calls `createRoutine` and `setActiveRoutine`, and empty state exposes the creation guide.
