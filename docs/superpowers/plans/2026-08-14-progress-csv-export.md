# Progress CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make progress CSV exports complete, Excel-friendly, and user-readable while staying offline.

**Architecture:** Keep `buildProgressExport` as the single data source. Change only CSV serialization in `src/domains/settings/services.ts`, expanding timeline rows into user-facing CSV rows and delegating escaping to Papa Parse.

**Tech Stack:** React 19, TypeScript, Vite, Dexie, Vitest, Papa Parse.

## Global Constraints

- Do not change `exportProgressJson` behavior or format.
- Do not make runtime network calls or use external services.
- Keep the existing `downloadText` download mechanism.
- Keep existing `ProgressExportFilters` behavior.
- No git commits for this task.

---

### Task 1: CSV Regression Test

**Files:**
- Modify: `src/domains/settings/services.test.ts`

**Interfaces:**
- Consumes: `exportProgressCsv(filters?: ProgressExportFilters)`
- Produces: failing coverage for BOM, Spanish header, drop rows, and numeric formatting.

- [ ] **Step 1: Write the failing test**

Add a drop set to the existing export fixture and assert:

```ts
expect(csv.startsWith('\ufeff')).toBe(true)
expect(csv).toContain('Fecha;Rutina;Dia;Ejercicio;Musculo;Equipo;Serie;Tipo de serie;Serie principal;Peso (kg);Repeticiones;RIR;Volumen;Puntaje')
expect(csv).toContain('principal')
expect(csv).toContain('drop')
expect(csv).toContain(';drop;1;40,00;10;2;400,00;')
```

- [ ] **Step 2: Run focused test to verify RED**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: FAIL because current CSV has technical headers, no BOM, and no drop rows.

### Task 2: CSV Dependency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `papaparse` runtime dependency and TypeScript types if required.

- [ ] **Step 1: Check package size/current metadata**

Run: `npm view papaparse version dependencies dist.unpackedSize`

- [ ] **Step 2: Install dependency**

Run: `pnpm add papaparse`

If TypeScript needs declarations, also run: `pnpm add -D @types/papaparse`.

### Task 3: CSV Implementation

**Files:**
- Modify: `src/domains/settings/services.ts`

**Interfaces:**
- Consumes: `buildProgressExport(filters)` timeline rows with `dropSets`.
- Produces: CSV string passed to `downloadText(filename, csv, 'text/csv;charset=utf-8')`, starting with BOM and `sep=;` for Excel separator detection.

- [ ] **Step 1: Replace manual serialization**

Import Papa Parse and call `Papa.unparse(rows, { delimiter: ';', header: false })`.

- [ ] **Step 2: Build user rows**

For each timeline row, emit the main row and then sorted drop rows:

```ts
[
  row.date,
  row.routineName,
  row.dayName,
  row.exerciseName,
  row.mainMuscle,
  row.equipment,
  formatInteger(row.setOrder),
  'principal',
  '',
  formatDecimal(row.weightKg),
  formatInteger(row.reps),
  formatInteger(row.rir),
  formatDecimal(volumeForSet(row)),
  formatDecimal(row.score),
]
```

Drop rows use `Drop ${dropSet.order + 1}` in `Serie`, `row.setOrder` in `Serie principal`, `dropSet.weightKg`, `dropSet.reps`, `dropSet.rir`, `volumeForSet(dropSet)`, and `performanceScore(dropSet)`. Text fields are normalized to one physical line before Papa Parse serializes them.

- [ ] **Step 3: Remove `escapeCsvCell`**

Delete the manual escaping helper once Papa Parse owns serialization.

- [ ] **Step 4: Run focused test to verify GREEN**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: PASS.

### Task 4: Verification

**Files:**
- Review all modified files.

- [ ] **Step 1: Run full tests**

Run: `pnpm test`

- [ ] **Step 2: Run production build**

Run: `pnpm build`

- [ ] **Step 3: Review diff**

Run: `git diff -- package.json pnpm-lock.yaml src/domains/settings/services.ts src/domains/settings/services.test.ts docs/superpowers/specs/2026-08-14-progress-csv-export-design.md docs/superpowers/plans/2026-08-14-progress-csv-export.md`

Confirm no JSON export behavior changed and no commits were made.
