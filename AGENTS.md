# AGENTS.md

Arsen is a mobile-first, 100% offline workout tracker. React 19 + TypeScript + Vite + Tailwind v4 + Dexie (IndexedDB). All data lives client-side; no backend.



You are the AI agent working in this repository. This file is written directly to you — follow
it as instructions, not as background context. It applies to every task, on your first message,
with no exceptions and no need to be reminded.

## Skills you must use (always installed — never check if they exist, just use them)

- **`superpowers:using-superpowers`** — Use this only as a lookup table: task is a feature/design
  change/refactor → it tells you to use `brainstorming`; task is a bug fix → it tells you to use
  `systematic-debugging`. Do not treat it as something that decides *whether* you run the
  mandatory process below — that part is not up to this skill.
- **`superpowers:brainstorming`** — Run this before you write any code for a feature, design
  change, or refactor. Turn the rough idea into a short design doc through questions and
  alternatives. Save that doc before you touch code.
- **`superpowers:systematic-debugging`** — Run this for every bug fix. It is rigid: follow its
  4 phases (investigate → root cause → hypothesis → fix) exactly, in order. Do not skip phases
  because the bug looks simple. Do not let `ponytail` shrink or skip any of these phases —
  Superpowers itself marks debugging as non-negotiable, independent of anything else in this file.
- **`superpowers:verification-before-completion`** — Run this before you say a task is done, for
  every feature and every bug fix. Confirm the thing actually works — run the tests, check the
  behavior — before you report completion. Never report a task as complete without having run
  this.
- **`impeccable`** — Use this whenever the task touches UI, full stop. It loads `PRODUCT.md` and
  `DESIGN.md` for you automatically on every command — you don't need to load them yourself.
- **`ponytail`** — Actually invoke this skill (via your skill tool, or `/ponytail full` if the
  command is available) before you write code — do not treat the ladder written in this file as
  a substitute for running the skill itself. The skill's own SKILL.md is the source of truth;
  this file only tells you when and at what intensity to run it. Keep it active on every
  response, at `full` intensity. Do not switch to `ultra` (it questions the requirement itself —
  that is not your call to make). Do not switch to `lite` (it only flags the leaner option
  without applying it — you must apply it).

## Design context you already have

`PRODUCT.md` and `DESIGN.md` already exist in this repo. Every `impeccable` command loads them for
you automatically. Do not recreate them and do not hand-edit `DESIGN.md`. If a change makes the
live UI drift from what `DESIGN.md` describes, run `/impeccable document` to regenerate it from
the current source instead.

## On every new task, do this in order

1. Check the current state of the repo. Confirm what is already implemented before you plan
   anything.
2. If a partial implementation already exists, change only what is necessary to meet the
   criteria — do not rewrite what already works.
3. Respect the architecture already defined in this repo.
4. Add or update tests when your change touches calculations, validation, repositories, or any
   critical flow.
5. Classify the task using `using-superpowers`: feature / design change / refactor →
   `brainstorming`; bug fix → `systematic-debugging`. If the task is both (see "Mixed case"
   below), follow that section instead of picking one.
6. Run the process skill from step 5 to a short plan — what you will build, how you will verify
   it — before you touch code. This step is never optional and never skipped for task size.
7. Before you create a branch, commit, push, or merge anything: stop and ask the human first.
   This overrides Superpowers' own defaults — `using-git-worktrees` and
   `finishing-a-development-branch` normally do these automatically as part of their process; you
   must not let them. Stage the change, describe it, then wait for explicit confirmation.
8. If the task touches UI or anything rendered to a user, run these `impeccable` commands — this
   step is mandatory once UI is touched, and you do not get to decide it doesn't apply:
   - Plan: `/impeccable shape` before you build.
   - Before you close the task, run both of these pairs — they are not interchangeable, run both:
     - `/impeccable critique` → `/impeccable polish` (review the UI, then refine it).
     - `/impeccable audit` → `/impeccable harden` (find technical issues, then fix them).
   - Impeccable's edit hooks also fire automatically on every UI change and report findings back
     to you inline. Treat that as a background safety net only — it does not replace the explicit
     passes above; run them anyway.
   - If the task is purely backend/logic/script work with no visual output, skip this step
     entirely and say so.
9. Check for any other installed skill that fits this task — testing, a specific pattern, a
   project-specific skill — and use it if it applies. This step depends on the task, unlike
   steps 6 and 8. If none applied, say so in your response and say why.
10. Invoke the `ponytail` skill itself before you implement — don't reconstruct its ladder from
    memory or from the summary below, actually call the skill so its current SKILL.md governs.
    Its ladder, in this exact order, for every piece of code you write:
    1. Does this need to exist at all? If the need is speculative, skip it and say so (YAGNI).
    2. Does something in this codebase already do it? Reuse it instead of rewriting it.
    3. Does the standard library do it? Use that.
    4. Does a native platform feature do it? Use that.
    5. Does an already-installed dependency do it? Use that.
    6. Can it be one line? Make it one line.
    7. Only if none of the above apply, write the minimum code that works.
    Do not let this ladder cut corners on understanding the problem — read the full flow the
    change touches before you pick a rung. Skipping comprehension to ship a small diff is not
    minimalism, it's a wrong fix wearing a small diff.
11. Run `verification-before-completion` before you tell the human the task is done.
12. When skills conflict, resolve it in this order:
    - Superpowers governs process — how you explore, plan, and verify. Within Superpowers itself:
      follow TDD and debugging exactly; adapt patterns to context.
    - Impeccable governs visual/design quality, only when UI is touched. Ponytail may not cut
      below Impeccable's bar.
    - Ponytail governs code size and scope, but never at the cost of input validation at trust
      boundaries, error handling that prevents data loss, security, or accessibility. This is
      Ponytail's own stated limit — not just a rule added here.
13. Never simplify away: input validation at trust boundaries, error handling that prevents data
    loss, security, accessibility, or anything the human explicitly asked for.

## Mixed case: a bug fix that turns out to need a structural change

Start in `systematic-debugging` and complete its phases through root-cause identification. If the
fix for that root cause requires a structural or design change rather than a local patch, switch
to `brainstorming` at that point, for that follow-on decision only. Do not open a `brainstorming`
pass before root cause is established just because you suspect the task will end up needing one —
that is the exact failure mode Superpowers warns against: never default to brainstorming for a bug.

## Reminder

Apply this entire file by default, on every task, starting from the first message. Do not wait to
be told to follow it again.


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
