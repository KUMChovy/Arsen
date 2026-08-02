# Export Import Schema Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep routine, full-backup, and progress exports valid while accepting old and new import data for recent routine schema fields.

**Architecture:** Put legacy defaults in `src/shared/validation/arsenImportSchemas.ts`, because routine imports and full-backup imports both pass through those schemas. Keep export documentation near the public export functions. Add focused tests for schema migrations and progress export serialization/CSV escaping.

**Tech Stack:** React 19, TypeScript, Vite, Dexie, Zod, Vitest, fake-indexeddb.

## Global Constraints

- No UI change is required.
- Do not add dependencies.
- Do not commit without human approval.
- Defaults for legacy routine exercises are `repsMin: 8`, `repsMax: 10`, `technicalNotes: ''`, `currentWeightKg: 0`, and load defaults from `loadSettingsForEquipment`.
- Preserve storage weight in kg.

---

### Task 1: Legacy Defaults In Import Schemas

**Files:**
- Modify: `src/shared/validation/arsenImportSchemas.ts`
- Test: `src/shared/validation/arsenImportSchemas.test.ts`

**Interfaces:**
- Consumes: `loadSettingsForEquipment(input)` and `normalizeWarmupProtocol(value)`.
- Produces: `routineExportSchema` and `backupSchema` that parse old and new records with defaults.

- [ ] **Step 1: Write failing schema tests**

Add tests that call `routineExportSchema.safeParse` and `backupSchema.safeParse` with missing `repsMin`, `repsMax`, `technicalNotes`, `currentWeightKg`, `loadMode`, and `barWeightKg`.

- [ ] **Step 2: Run the focused schema test**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts`

Expected before implementation: legacy tests fail because required fields are missing.

- [ ] **Step 3: Add minimal schema defaults**

In `routineExerciseSchema`, change these fields to defaults:

```ts
currentWeightKg: z.number().optional().default(0),
repsMax: z.number().optional().default(10),
repsMin: z.number().optional().default(8),
technicalNotes: z.string().optional().default(''),
```

In `exerciseLogSchema.snapshot`, default legacy ranges:

```ts
repsMax: z.number().optional().default(10),
repsMin: z.number().optional().default(8),
```

Keep existing load and warmup transforms.

- [ ] **Step 4: Re-run schema test**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts`

Expected: schema tests pass.

### Task 2: Export Documentation

**Files:**
- Modify: `src/domains/routine/importExport.ts`
- Modify: `src/domains/settings/services.ts`

**Interfaces:**
- Consumes: existing export functions.
- Produces: JSDoc comments documenting routine JSON, full backup JSON, progress JSON, and progress CSV shapes.

- [ ] **Step 1: Add JSDoc above public export functions**

Document:

```ts
/**
 * Exports one routine JSON file: routine metadata, its days, day exercises, and weekly volume targets.
 */
```

For backup:

```ts
/**
 * Exports a full IndexedDB backup JSON file with every persisted Arsen table.
 */
```

For progress JSON:

```ts
/**
 * Exports progress JSON: summary, graph points, and chronological main-set timeline.
 */
```

For progress CSV:

```ts
/**
 * Exports progress CSV from the same timeline as progress JSON, with one row per main set.
 */
```

- [ ] **Step 2: Typecheck through test/build later**

No separate test is needed for comments.

### Task 3: Progress Export Regression Tests

**Files:**
- Create: `src/domains/settings/services.test.ts`

**Interfaces:**
- Consumes: `buildProgressExport`, `exportProgressCsv`, `db`, and download utilities mocked with Vitest.
- Produces: tests proving JSON serialization and CSV escaping remain valid.

- [ ] **Step 1: Write tests with fake IndexedDB data**

Seed minimal routine, day, exercise, session, exercise log, and set log. Assert:

```ts
const data = await buildProgressExport()
expect(() => JSON.stringify(data)).not.toThrow()
expect(data.timeline).toHaveLength(1)
```

Mock `downloadText`, call `exportProgressCsv`, and assert the CSV header plus escaped commas/quotes/newline behavior.

- [ ] **Step 2: Run the focused settings service test**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected before final implementation: failures only if helper access or mocks need small adjustments.

- [ ] **Step 3: Make the smallest implementation adjustment if needed**

If `escapeCsvCell` is already correct, do not change production CSV logic.

- [ ] **Step 4: Re-run focused settings service test**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: progress export tests pass.

### Task 4: Final Verification

**Files:**
- Read: `docs/superpowers/specs/2026-08-02-export-import-schema-coverage-design.md`
- Read: `docs/superpowers/plans/2026-08-02-export-import-schema-coverage.md`

**Interfaces:**
- Consumes: all changed code and tests.
- Produces: verification evidence for the acceptance criteria.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm test src/shared/validation/arsenImportSchemas.test.ts src/domains/settings/services.test.ts
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- src/shared/validation/arsenImportSchemas.ts src/shared/validation/arsenImportSchemas.test.ts src/domains/routine/importExport.ts src/domains/settings/services.ts src/domains/settings/services.test.ts docs/superpowers/specs/2026-08-02-export-import-schema-coverage-design.md docs/superpowers/plans/2026-08-02-export-import-schema-coverage.md
```

Confirm no unrelated files are changed.
