# SweetAlert Mobile Arsen Design

## Context

Arsen already routes confirmations and important alerts through `src/shared/utils/alerts.ts`. The helpers work, but each helper repeats SweetAlert2 visual options and uses raw colors. The workout set editor is already a mobile sheet with separate numeric fields, so this task should preserve that flow and only fix SweetAlert presentation.

## Accepted Direction

- Keep SweetAlert2 as the app-wide mechanism for confirmations, action confirmations, success alerts, and error alerts.
- Centralize Arsen SweetAlert2 identity in `shared/utils/alerts.ts` with shared popup options, button classes, and per-helper tone overrides.
- Put responsive SweetAlert2 CSS in `src/styles.css`, using the existing Arsen dark, purple, acid, and danger visual roles.
- Keep alert width constrained with `width: min(92vw, 380px)` and mobile-safe spacing so the popup never creates horizontal overflow.
- Make action buttons touch-friendly, wrapping or stacking on narrow screens instead of cutting text.
- Do not replace `EditSetSheet`; it already satisfies the separate-field requirement for editing series and drop sets.

## Boundaries

- No new dependencies.
- No broad modal abstraction.
- No changes to data flow, Dexie services, or workout calculations.
- No commits without explicit human approval.

## Verification

- Search confirms direct SweetAlert2 calls remain centralized.
- `pnpm test` covers existing mocked alert call sites.
- `pnpm build` verifies TypeScript and production bundle.
- Run Impeccable detector on changed UI targets and address actionable findings.
