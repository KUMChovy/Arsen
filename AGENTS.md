# AGENTS.md

Arsen is a mobile-first, 100% offline workout tracker. React 19 + TypeScript + Vite + Tailwind v4 + Dexie (IndexedDB). All data lives client-side; no backend.

## every new task

## Skills you must use

This project requires you to actively use these installed skills — not only when you judge
they "feel" relevant, but as a standing requirement on every task:

- **`using-superpowers`** — the skill router. Governs whether/how the others below trigger.
- **`superpowers:brainstorming`** / **`superpowers:systematic-debugging`** — process. Always
  mandatory.
- **`impeccable`** — UI/visual design quality. Mandatory whenever the task touches UI.
- **`ponytail`** — implementation sizing/minimalism. Always mandatory.

You must invoke them, not just keep them in mind. Failing to invoke a skill that applies is a
failure to follow this file, not a judgment call you get to make on your own.

## every new task

## Skills you must use

This project requires you to actively use these installed skills — not only when you judge
they "feel" relevant, but as a standing requirement on every task:

- **`using-superpowers`** — the skill router. Governs whether/how the others below trigger.
- **`superpowers:brainstorming`** / **`superpowers:systematic-debugging`** — process. Always
  mandatory.
- **`impeccable`** — UI/visual design quality. Mandatory whenever the task touches UI.
- **`ponytail`** — implementation sizing/minimalism. Always mandatory.

You must invoke them, not just keep them in mind. Failing to invoke a skill that applies is a
failure to follow this file, not a judgment call you get to make on your own.

## every new task

For **every new task** you're asked to do (a feature, a fix, a refactor, anything), follow
this workflow without needing to be asked again:

1. **Skill check first, per `using-superpowers`.** Before planning, asking clarifying
   questions, or coding, check which skills apply — this repo's `AGENTS.md` still overrides
   any skill on conflict (per `using-superpowers`' own instruction-priority rule: user
   instructions win).
2. **Process — mandatory, always, no exceptions:** `superpowers:brainstorming` for a new
   feature, design change, or refactor; `superpowers:systematic-debugging` for a bug fix.
   Never skip based on task size, and never default to brainstorming for a bug — debugging is
   a different process. Refine the idea, explore alternatives, define a short plan (what will
   be built, how it will be verified) before touching code.
3. **Never commit automatically.** `writing-plans` and `executing-plans` default to frequent
   commits as part of their own methodology and will commit without asking. That default is
   overridden here: never run `git commit` or `git push` on your own initiative, even mid-plan
   or between checkpoints. Stage and describe the change, then stop and wait for explicit
   confirmation from the human before committing. This applies regardless of which skill or
   step is currently driving the work.
4. **UI/visual work — mandatory once touched.** If the task involves HTML/CSS, components,
   layout, or anything rendered to a user, this stops being optional. If the project already
   documents its design system by hand somewhere (a styleguide section, a tokens file, a
   design spec doc), fold that into the resulting DESIGN.md afterward so there's one source
   of truth, not two. During planning:
   `/impeccable shape` (new UI) or `/impeccable critique` (existing UI being changed). Before
   closing: `/impeccable audit` + `/impeccable polish`. Purely backend/logic/script tasks with
   no visual output skip this step entirely.
5. **Other relevant skills.** Check for and use any other installed skill that fits the
   problem — debugging, testing, a specific pattern, a project-specific skill. These depend
   on applicability; steps 2 and 4 don't, once their trigger condition is met.
6. **Implement with Ponytail.** Once the plan is clear, invoke the ponytail skill and follow
   its own decision ladder exactly as defined in it — don't rewrite it here.
7. **Priority on conflict:**
   - **Superpowers governs process** — how to explore the problem, plan, and verify.
   - **Impeccable governs visual/design quality**, only when UI is touched — a floor, not
     something ponytail can trim.
   - **Ponytail governs code size/scope** — never at the cost of validation, error handling
     that prevents data loss, security, accessibility, or Impeccable's visual-quality bar
     when it applies.
8. **Never simplify away** input validation at trust boundaries, error handling that prevents
   data loss, security, accessibility, or anything explicitly requested.

This is not optional and does not depend on being repeated in the message: apply this
workflow by default on every task, starting from the first message of each new task. If no
extra skill (step 5) was used, say so and justify why none applied. If the task touched UI
and Impeccable wasn't run (or vice versa), say so and justify why.

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
