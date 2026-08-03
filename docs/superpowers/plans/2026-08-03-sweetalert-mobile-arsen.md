# SweetAlert Mobile Arsen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SweetAlert2 confirmations, alerts, and future simple forms feel native to Arsen on mobile without changing app data behavior.

**Architecture:** Keep the public alert helpers in `src/shared/utils/alerts.ts`, add a small shared SweetAlert2 options layer there, and style its classes from `src/styles.css`. Existing pages continue importing `confirmDanger`, `confirmAction`, and `showAlert`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4 CSS tokens, SweetAlert2 dynamic import.

## Global Constraints

- Arsen is mobile-first and must work down to 360px.
- UI strings stay Spanish es-MX.
- Use existing Arsen visual tokens; avoid raw component colors where CSS can own the theme.
- SweetAlert2 remains lazy-loaded through dynamic import.
- Do not add dependencies.
- Do not commit without explicit human approval.

---

### Task 1: Central SweetAlert2 Helper Styling

**Files:**
- Modify: `src/shared/utils/alerts.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: SweetAlert2 default export loaded with `await import('sweetalert2')`
- Produces: existing exported functions `confirmDanger(title: string, text: string): Promise<boolean>`, `confirmAction(title: string, text: string, confirmButtonText?: string): Promise<boolean>`, and `showAlert(title: string, text: string, icon?: AlertIcon): Promise<void>`

- [ ] **Step 1: Inspect current direct SweetAlert2 usage**

Run: `rg -n "Swal|sweetalert|confirmDanger|confirmAction|showAlert" src`

Expected: direct `Swal.fire` usage is limited to `src/shared/utils/alerts.ts`; pages consume helpers.

- [ ] **Step 2: Add shared SweetAlert2 options**

In `src/shared/utils/alerts.ts`, create a small helper that returns shared options:

```ts
function arsenAlertOptions(confirmButtonClass = 'arsen-swal-confirm') {
  return {
    background: 'transparent',
    buttonsStyling: false,
    color: 'var(--color-arsen-ink)',
    customClass: {
      actions: 'arsen-swal-actions',
      cancelButton: 'arsen-swal-button arsen-swal-cancel',
      confirmButton: `arsen-swal-button ${confirmButtonClass}`,
      container: 'arsen-swal-container',
      htmlContainer: 'arsen-swal-text',
      icon: 'arsen-swal-icon',
      popup: 'arsen-swal-popup',
      title: 'arsen-swal-title',
    },
    heightAuto: false,
    reverseButtons: true,
    width: 'min(92vw, 380px)',
  } as const
}
```

Use it in `confirmDanger`, `confirmAction`, and `showAlert`. `confirmDanger` uses `arsen-swal-danger`; error alerts use the same danger class; success alerts use `arsen-swal-acid`; ordinary action confirmations use `arsen-swal-confirm`.

- [ ] **Step 3: Add responsive global CSS**

In `src/styles.css`, add rules for `.arsen-swal-*` classes. The popup uses Arsen dark surfaces, compact type, 12px border radius, max width, no horizontal overflow, and 48px minimum buttons. At `max-width: 380px`, actions become a single column and each button is full-width.

- [ ] **Step 4: Verify no fragile set-edit prompt remains**

Run: `rg -n "prompt|input:\\s*['\"]text|Swal" src\\domains\\workout src\\shared`

Expected: editing series remains in `EditSetSheet.tsx`; no text prompt is used for set editing.

- [ ] **Step 5: Run checks**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm build`

Expected: TypeScript, Vite build, and service worker generation complete.

Run: `node C:\Users\Chovy\.agents\skills\impeccable\scripts/detect.mjs --json src/shared/utils/alerts.ts src/styles.css src/domains/workout/components/EditSetSheet.tsx`

Expected: no actionable responsive, overflow, contrast, or button clipping findings remain for the changed targets.
