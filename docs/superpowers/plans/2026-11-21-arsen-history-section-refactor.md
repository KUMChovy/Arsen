# Historial Section Refactor Implementation Plan

> **For inline execution:** Use `superpowers:executing-plans` to implement this plan task-by-task. Do not use subagents or `subagent-driven-development`.

**Goal:** Separate Historial from Progreso, remove legacy calendar entry points, paginate the chronological list, and make detail actions icon-first.

**Architecture:** Reuse `getHistory`, `HistoryFilters`, `HistoryView`, and the session-ID detail page. Add a thin `HistoryPage` composition, a first-level navigation route, and keep old date/session routes only as compatibility aliases.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind v4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-arsen-history-section-refactor-design.md`

## Tasks

### Task 1: Paginate and iconify the existing history/detail UI

- [ ] Add failing tests for 20-item pagination and icon-only exercise actions.
- [ ] Implement pagination state in `HistoryView`; keep calendar date marking based on all sessions.
- [ ] Replace detail action text with Lucide icon buttons and accessible labels.
- [ ] Run focused history/detail tests and typecheck.

### Task 2: Extract Historial into a first-level route

- [ ] Add failing navigation/page tests for `/historial` and two Progress tabs.
- [ ] Create `HistoryPage` using existing history hooks/components.
- [ ] Add `Historial` to bottom navigation and register `/historial` plus `/historial/sesion/:sessionId`.
- [ ] Remove the old `TrainingCalendarSheet` mount and history state from `ProgressPage`.
- [ ] Update exercise/detail links to the new route while retaining compatibility routes.
- [ ] Run the full suite and production build.
