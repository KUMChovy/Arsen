# Calendario principal del Historial Implementation Plan

> **For agentic workers:** Execute this plan inline in the current workspace; no implementation or review subagents.

**Goal:** Abrir Historial en calendario y hacer más cómoda la lista cronológica.

**Architecture:** Ajustar el estado inicial de `HistoryPage` para usar calendario salvo que la URL solicite lista. Reducir visualmente cada `HistorySessionCard` sin cambiar contratos ni datos.

**Tech Stack:** React 19, TypeScript, React Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-21-arsen-history-calendar-default-design.md`

## Global Constraints

- El historial sigue siendo offline y no requiere migración de datos.
- La lista mantiene paginación de 20 sesiones.
- Los enlaces deben seguir abriendo el detalle exacto por `sessionId`.

## Review Focus

- Entrada sin `modo`: debe seleccionar Calendario.
- Entrada con `modo=list`: debe seleccionar Lista.
- Lista con muchos registros: debe conservar paginación y metadatos esenciales.
- Vista estrecha de 360 px: la fila debe truncar sin desbordar horizontalmente.

---

### Task 1: Default calendar and compact list

**Files:**
- Modify: `src/domains/progress/pages/HistoryPage.tsx`
- Modify: `src/domains/progress/components/HistoryView.tsx`
- Test: `src/domains/progress/pages/HistoryPage.test.tsx`
- Test: `src/domains/progress/components/HistoryView.test.tsx`

- [ ] Write failing tests for default calendar and explicit list mode.
- [ ] Run the focused tests and confirm the default-calendar assertion fails.
- [ ] Implement the URL-aware default and compact row layout.
- [ ] Run focused tests and the full suite.
- [ ] Run `pnpm build`.

