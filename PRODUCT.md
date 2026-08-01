# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Arsen is for a Spanish-speaking lifter training from their phone who wants fast offline logging and trustworthy progress history.

## Product Purpose

Arsen is a mobile-first workout tracker for strength training. It helps the user execute today's routine, register sets and drop sets, manage routines, review progress, and move data through backups and exports without depending on a backend.

Success means the user can train with minimal friction, keep historical logs readable even after routines change, and trust that their data remains available offline.

## Positioning

Arsen's core mechanism is local-first workout history: all data lives client-side in IndexedDB, logs preserve exercise snapshots at training time, and progress joins related exercises across routines by canonical name instead of depending on mutable routine labels.

## Operating Context

The app is used primarily on a phone during workouts. The main flows are daily training, routine management, progress review, backup/import/export, settings, and storage management.

Routes in the current app:

- `/` for today's training.
- `/rutina` for routines.
- `/rutina/dia/:dayId` for routine day detail.
- `/progreso` for performance and progress.
- `/progreso/historial/:date` for training history by date.
- `/settings` for app settings, backups, imports, exports, units, notifications, storage, and cleanup.

## Capabilities and Constraints

Arsen is a React 19, TypeScript, Vite, Tailwind v4, Dexie, IndexedDB app. It has no backend, authentication, or cloud sync. Production builds generate a hashed service worker after Vite build.

All durable data is client-side. Storage weight is always kg; the UI converts to lb when the preferred unit is lb. UI strings and demo data are Spanish (`es-MX`).

The routine, workout, progress, and settings domains are separated. Cross-domain access should go through each domain's services or hooks, and repositories own Dexie access.

Historical logs must not break when routines, days, or exercises are renamed or deleted. Drop sets contribute to workout volume but do not count for ready-to-increase-weight recommendations.

## Brand Commitments

The product name is Arsen. The interface language is Spanish, with concise training-focused copy. Existing app assets include `public/icon.svg`, `src/assets/arsen-exercise-sprite.png`, and `src/assets/arsen-muscle-groups-sprite.png`.

The incumbent visual implementation is a compact, mobile-first fitness app interface. Durable visual-system documentation is intentionally not captured here; use `DESIGN.md` or an Impeccable document/new-work flow for visual decisions.

## Evidence on Hand

Project evidence:

- `AGENTS.md` documents architecture, commands, conventions, and project gotchas.
- `docs/superpowers/specs/2026-07-20-arsen-design.md` records the original product and implementation direction.
- `docs/superpowers/specs/2026-07-20-arsen-mobile-refactor-design.md` records approved mobile refactor decisions.
- `docs/superpowers/specs/2026-07-22-arsen-training-routine-progress-upgrade-design.md` records later training, routine, and progress upgrades.
- `src/db/data/demo-routine.json` contains the seed routine and weekly volume targets.
- `public/manifest.webmanifest` identifies Arsen as a standalone Spanish fitness/productivity web app.

There is no evidence of real customers, testimonials, pricing, backend infrastructure, cloud sync, or external exercise catalog integration in the current repo.

## Product Principles

1. Keep training fast on a phone.
2. Preserve user data and historical meaning before optimizing for convenience.
3. Stay offline-first and backend-free unless the product direction explicitly changes.
4. Keep routine recipes editable without corrupting past workout logs.
5. Prefer compact, scannable workflows over broad configuration surfaces.

## Accessibility & Inclusion

The product is mobile-first and should remain usable at narrow phone widths down to 360px. Interactive controls need clear labels, visible focus states, and touch-friendly sizing. Spanish copy should stay understandable without relying on English gym software terminology where a natural Spanish label exists.
