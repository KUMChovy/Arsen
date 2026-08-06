# AGENTS.md

You are the AI agent working in this repository. This file gives you the *process* to follow; it does not replace the skills it points to. Read it in full before starting any task that could change files. It is written to be reusable across projects — project-specific details go in §12, not in the rest of this file.

**Requires:** Superpowers, Ponytail, Impeccable. See the install list your human keeps alongside this file, or ask them for it.

## 0. Authority order

When any of the following conflict, resolve in this order:

1. **§9 ("Never relax") always wins** — no skill, mode, or instruction overrides it.
2. **Each skill's own SKILL.md governs how that skill works.** Anything this file says about a skill's internals (a ladder, a phase count, a command list) is a pointer, not a spec. If the installed SKILL.md disagrees with this file, follow the SKILL.md and flag the discrepancy to the human — don't silently follow the stale description here.
3. **Between skills:** Superpowers governs process (investigation, planning, debugging, verification) > Impeccable governs visual/design quality, only when UI is touched > Ponytail governs code size and scope, and may never cut validation, error handling, security, or accessibility below what Superpowers or Impeccable require.
4. **This file governs subagent usage and delegation** — execution mode, what may or may not run as a subagent. No skill, including Superpowers' own subagent-oriented skills, overrides this.
5. If a skill this file requires isn't installed, isn't found, or fails to load: stop and tell the human exactly which step you can't perform. Don't silently skip it or improvise a substitute.

## 1. Mandatory execution mode

For any task that may change code, tests, config, docs, or UI, pick the mode before planning or editing:

- **Inline** — you do everything: inspect, plan, implement, test, review, verify. No subagents.
- **Inline with explorer subagents** — you keep full responsibility for planning, decisions, implementation, testing, review, and verification. Subagents may only do read-only exploration.

Ask once:
> "Do you want this task performed entirely inline, or inline with read-only explorer subagents?"

Don't ask again once it's chosen for the task. Skip the question for informational questions, explanations needing no file changes, read-only analysis, or when the human already said no changes should be made or already picked a mode.

## 2. Execution modes

### Inline
Do all investigation yourself. No subagents of any kind — including Superpowers' `dispatching-parallel-agents`.

### Inline with explorer subagents
Explorers may: locate files/components/services/types/tests, trace data flows and dependencies, identify partial or reusable implementations, inspect how a pattern is applied elsewhere, compare current behavior to acceptance criteria, and report findings, risks, and file references.

Explorers must: receive a concrete, bounded question; stay read-only; return file paths and evidence; separate observed fact from recommendation; flag uncertainty; stop after their assigned investigation. They may run read-only/diagnostic commands — never destructive or persistent ones.

Explorers must never: edit, create, move, or delete files; write code; run data-modifying migrations; create branches, worktrees, commits, or tags; push, open PRs, or merge; make architectural decisions; expand scope; declare the task done; invoke or delegate to other subagents; run `subagent-driven-development`; act as autonomous implementers or reviewers.

This applies to *any* subagent mechanism a skill offers, including Superpowers' `dispatching-parallel-agents` — if invoked, it is bound by these same read-only rules.

Evaluate every explorer finding yourself before using it. A finding never replaces your own direct inspection of the affected flow.

## 3. Delegation limits

Never invoke or use:
- `subagent-driven-development`
- implementation or review subagents of any kind
- any workflow where a separate agent implements or approves a step you haven't reviewed yourself
- `dispatching-parallel-agents` outside the read-only mode described in §2

When Superpowers' own workflow reaches the "dispatch implementers" step, use `executing-plans` (batch execution with human checkpoints) instead of `subagent-driven-development`. This overrides Superpowers' default at that step.

Don't split implementation across subagents, even for tasks that look independent. All implementation, fixes, integration, tests, review, and final verification are done by you, inline.

## 4. Your responsibility as the primary agent

You alone: classify the task; inspect the repo's actual state; run brainstorming or systematic debugging; write and save the design; write the implementation plan; decide which explorer findings to use; make architectural decisions; invoke Ponytail; edit files; write/update tests; run Impeccable; review the full diff; run final verification; report the result.

Explorers never run this process — they're limited to read-only investigation.

## 5. Mandatory skills and when to invoke them

Assumed installed — don't check for them, use them when the situation applies. Each skill's own SKILL.md is authoritative for its mechanics; this table only says *when* to call it.

| Situation | Skill | Notes |
|---|---|---|
| Classify a new task | `superpowers:using-superpowers` | Lookup only: feature/design/refactor → brainstorming; bug → systematic-debugging. Never let it trigger `subagent-driven-development`. |
| New feature, design change, refactor, structural change | `superpowers:brainstorming` | Run before writing code. Save the resulting design doc before editing anything. |
| Turning an approved design into tasks | `superpowers:writing-plans` | Small, verifiable tasks with exact paths — don't jump from design straight to code. |
| Any bug fix | `superpowers:systematic-debugging` | All phases, in order, every time — never skipped for "simple" bugs. |
| Moving from plan to code | `superpowers:executing-plans` | The sanctioned path. Never `subagent-driven-development`. |
| Writing or changing code | `superpowers:test-driven-development` | Full red-green-refactor for implementation work. §7 is the floor that still applies when TDD doesn't naturally trigger. |
| Reviewing a diff before verification | `superpowers:requesting-code-review` / `receiving-code-review` | Use these instead of an ad hoc review pass. |
| Before declaring anything done | `superpowers:verification-before-completion` | Mandatory every time, features and fixes alike. |
| Branching, worktrees, merging | `superpowers:using-git-worktrees` / `finishing-a-development-branch` | Only after explicit human approval per §8 — never let them branch/commit/push on their own. |
| Before writing any code | `ponytail`, full intensity | Never `lite` (identifies without applying) or `ultra` (second-guesses the requirement — not your call). Its own ladder in SKILL.md governs, not any summary of it elsewhere. |
| Task touches UI or anything user-facing | `impeccable` | Loads `PRODUCT.md`/`DESIGN.md` automatically; never hand-edit either — regenerate with `/impeccable document` if the UI drifts from `DESIGN.md`. Minimum stages: `shape` before implementation; `critique` + `polish` **and**, separately, `audit` + `harden` before closing. Its own command list governs which other commands exist. |
| Anything else that looks specialized (testing, accessibility, security, migrations, a project-specific skill) | whichever fits | Use it if it exists. If nothing else applies, say so and briefly explain why. |

## 6. Respect what's already there

Inspect what's actually implemented before planning changes — don't assume the task description matches reality. If a partial implementation exists, keep what works and change only what's necessary. Follow the repo's existing architecture, conventions, and domain boundaries; don't introduce a parallel structure without a demonstrated, approved need.

## 7. Tests — the floor

Even when `test-driven-development` isn't the natural fit for a change (e.g., pure config or docs), tests are still required for: calculations, validation, repositories/persistence, migrations, data transformations, permissions, security, and any other behavior vulnerable to regression.

## 8. Git

Before creating a branch or worktree, committing, pushing, or merging: stop, explain exactly which operation you want to run, and get explicit approval. Show the pending changes and their state before asking. Approval for one operation is not standing approval for the next — ask again each time.

## 9. Never relax

Regardless of how minimal a fix looks, never remove or reduce: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, data integrity, required compatibility, or anything the human explicitly asked for.

## 10. Mixed case: a bug that needs structural change

Start with `systematic-debugging` and finish through root-cause identification first. Only if the root cause genuinely requires a structural change, run `brainstorming` for that follow-on design decision, document it, update the plan, and implement inline. Don't open brainstorming before identifying the root cause just because you suspect it'll need structural work — that's the exact anti-pattern Superpowers warns against. The execution mode chosen at the start stays in effect through the mixed case unless the human explicitly changes it.

## 11. Process checklist for every task that may touch the repo

1. Pick the execution mode (§1) — skip only where §1 says to skip it.
2. Inspect the current repository state before planning.
3. Classify with `using-superpowers`.
4. Run the matching skill (`brainstorming` or `systematic-debugging`) and produce a plan with `writing-plans`. Save the design doc first.
5. Invoke `ponytail` (full) before writing code.
6. If UI is involved, run `/impeccable shape` before implementation.
7. Implement inline via `executing-plans`, respecting §6 and §9. Apply `test-driven-development`; the §7 floor applies regardless.
8. For any git operation, stop and get approval (§8).
9. Review the full diff with `requesting-code-review`/`receiving-code-review`: scope not expanded, no duplicated logic, existing interfaces respected, compatibility/persistence preserved, adequate tests, no stray files, critical explorer findings directly confirmed.
10. If UI was touched: `critique` + `polish`, and separately `audit` + `harden`, before closing. Run `/impeccable document` if `DESIGN.md` has drifted.
11. Run `verification-before-completion` before reporting done. If something can't be verified, say exactly what, why, and what risk remains.
12. Check for any other applicable skill (§5, last row); state explicitly if none apply.


## 12. Final reminder

Apply this file by default, from the first message, without being reminded. Before any task that may modify the repo: pick inline or inline-with-explorers, respect that choice throughout, never use SDD or unauthorized subagents, and keep yourself solely responsible for the final result.

## Project-specific context 

Arsen is a mobile-first, 100% offline workout tracker. React 19 + TypeScript + Vite + Tailwind v4 + Dexie (IndexedDB). All data lives client-side; no backend.

## Commands

- `pnpm dev` — Vite dev server (default port 5180; logs in `.run/`).
- `pnpm build` — Runs `tsc -b` (typecheck), then `vite build`, then `node scripts/generate-sw.mjs`. The last step regenerates `dist/sw.js` with a content-hash cache version; do not skip it for production builds.
- `pnpm test` — Vitest (`--passWithNoTests`). Pure unit tests run in node; component/UI tests need `// @vitest-environment jsdom` and `import '@testing-library/jest-dom/vitest'` as the first two lines.
- `pnpm preview` — serve the built bundle.
- `pnpm demo:history` — writes `generated/arsen-demo-3-months-backup.json` from `src/db/data/demo-routine.json` for import via Settings.

Package manager is pinned to pnpm 11.2.2 (see `packageManager` in `package.json`). `.npmrc` enables `save-exact`, `ignore-scripts`, and `package-manager-strict`. Do not run `npm install`.

## Layout

```
src/
  app/         Router, AppShell, bottom nav, providers, SW registration
  db/          Dexie schema, seed, demo routine JSON
  domains/
    routine/   Routines, days, exercises, catalog (types/repository/services)
    workout/   Sessions, sets, drop sets, skips (today's training)
    progress/  History, charts, exports
    settings/  Backups, units, notifications, storage
  shared/      calculations, components, utils, validation
public/        icon.svg, manifest.webmanifest, sw.js (regenerated by build)
scripts/       generate-sw.mjs, generate-demo-history.mjs
```

Domain boundary rule: cross-domain code goes through a domain's `services.ts` or `hooks.ts`. Repositories own Dexie access; components stay UI-only.

## Key conventions

- **Snapshot pattern**: `ExerciseLog` stores a `snapshot` of the routine exercise at log time. Renaming or deleting a routine/days/exercise must never break historical logs. See design spec §"Modelo De Datos".
- **Global progress join**: charts and history join exercises across routines by `canonicalName` (lowercased, diacritics-stripped, non-alphanum → `-` via `shared/utils/normalize.ts`). The recipe (sets/reps/RIR/rest) lives on `RoutineExercise`; defaults live on `ExerciseCatalogItem`. Same catalog item can be added to multiple days with different recipes.
- **Weight unit**: storage is always kg. UI converts to lb when `settings.preferredUnit === 'lb'`. Use `shared/utils/weight.ts` helpers; do not multiply in components.
- **Drop sets do not count** for "ready to increase weight" recommendations — only main sets do (`shared/calculations/progression.ts`).
- **i18n**: UI strings and demo data are in Spanish (es-MX). `Intl.DateTimeFormat('es-MX', ...)` is used for weekday labels.
- **Styling**: Tailwind v4 with `@theme` tokens defined in `src/styles.css` (e.g. `arsen-bg`, `arsen-purple`, `arsen-acid`). Use these tokens; avoid raw hex/oklch in components.
- **Mobile-first width**: `AppShell` constrains content to `max-w-[430px]`. Designs must work down to 360px.
- **Routing**: all pages are lazy-loaded in `src/app/router.tsx`. Add new routes there; do not import pages directly from `main.tsx`.

## Testing notes

- DB integration tests (`src/db/indexeddb.test.ts`) reset the Dexie database per test via `db.close(); await db.delete(); await db.open()` — required because `fake-indexeddb/auto` is loaded once.
- `useLiveQuery` from `dexie-react-hooks` is mocked as `(cb) => cb()` in Settings tests.
- Domain services in component tests are mocked with `vi.mock(...)`; the test file does not hit Dexie.
- Run a single file: `pnpm test src/path/to/file.test.ts`.

## Database

- Single Dexie database named `arsen`, schema version managed in `src/db/schema.ts`. When changing a table's indexes, bump `CURRENT_SCHEMA_VERSION` and add a `this.version(n).stores({...})` block.
- First-load seed (`src/db/seedDemoRoutine.ts`) is idempotent: it runs only if `db.settings.get('app')` returns nothing. Editing the demo JSON and clearing settings in IndexedDB is how you reseed.
- Backup format and import validation live in `src/shared/validation/arsenImportSchemas.ts` (zod). Importing with mode `replace` overwrites all tables; `merge` keeps local rows and adds remote ones.

## Service worker

- `public/sw.js` is the placeholder; the real one with hashed assets is written to `dist/sw.js` by `scripts/generate-sw.mjs` and is only loaded in production (`import.meta.env.DEV` skips registration in `src/app/registerServiceWorker.ts`).
- Caching strategy: network-first for navigations (fallback to `/index.html`), cache-first for other GETs.

## Project-specific gotchas

- `ignore-scripts=true` in `.npmrc` means postinstall hooks do not run. If a tool seems missing, install it manually rather than blaming the hook.
- `.superpowers/` and `.run/` are gitignored — they hold spec/agent artifacts and dev server logs; do not commit them.
- `generated/` is the output dir for `pnpm demo:history`; the file inside is importable into the app, not a test fixture.
- Specs and implementation plans live in `docs/superpowers/specs/`. Read the relevant `.md` before large feature work. Current specs: `2026-07-20-arsen-design.md`, `2026-07-20-arsen-implementation-plan.md`, `2026-07-20-arsen-mobile-refactor-design.md`, `2026-07-20-arsen-mobile-refactor-implementation-plan.md`, `2026-07-22-arsen-training-routine-progress-upgrade-design.md`.
- The `imagegen` skill under `.agents/skills/` is the official way to generate bitmap exercise/muscle-group art (see `src/assets/arsen-exercise-sprite.png`); do not call external image APIs directly.

## Before committing

1. `pnpm test` — all unit and integration tests pass.
2. `pnpm build` — typecheck + Vite build + SW generation succeed. The `tsc -b` step will fail on `noUnusedLocals`, `noUnusedParameters`, or `noUncheckedIndexedAccess` (strict mode is on).
