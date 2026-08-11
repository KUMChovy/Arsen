# Sinful Shell Catalog Design

## Objective

Add Sinful Shell as a bundled, read-only exercise library that is independent from the user's personal IndexedDB catalog.

The user can browse Sinful Shell by muscle, search by name or aliases, open a detail view, review the image and required technical content, and then choose whether to add a copy to their personal catalog. Tapping a Sinful Shell card never imports the exercise directly.

The approved source files are:

- `C:/Users/Chovy/Desktop/Proyevtos/datos_obligatorios_catalogo_sinful-shell.json`
- `C:/Users/Chovy/Desktop/Proyevtos/lista_imagenes_sinful-shell.md`

The implementation must not invent, rename, remove, or combine entries from those annexes without explicit approval.

## Scope

Included:

- Static Sinful Shell manifest V1 with exactly 74 exercises and the required fields.
- Runtime/test validation for required fields, duplicate IDs, existing bundled assets, and `technicalNotes` prefix.
- Dedicated reusable bottom sheet browser opened from the Catalog tab and from the current Add Exercise flow.
- Detail-first flow before import.
- Reuse the existing catalog editor in a `create-from-sinful-shell` mode.
- Optional, backwards-compatible origin and lock fields on `ExerciseCatalogItem`.
- Service-level validation that protected Sinful Shell content comes from the manifest, not from form input.
- Deduplication by `sinfulShellId`.
- Propagation of `bundledAssetId` to routine exercises and historical snapshots.
- Zod import/export compatibility for old and new backups.

Out of scope:

- External exercise APIs.
- Editing the Sinful Shell manifest from the UI.
- Seeding Sinful Shell into IndexedDB.
- One-tap import from a Sinful Shell card.
- Replacing the existing personal catalog.
- Changing Dexie indexes or bumping schema version unless an indexed field is later required.

## Static Manifest

Create `src/domains/routine/data/sinfulShellCatalog.ts`.

It exposes:

```ts
export type SinfulShellExercise = {
  id: string
  name: string
  canonicalName: string
  mainMuscle: MuscleGroup
  aliases: string[]
  technicalNotes: string
  bundledAssetId: string
}

export const SINFUL_SHELL_SCHEMA_VERSION = 1
export const sinfulShellCatalog: SinfulShellExercise[]
```

The 74 entries are generated from the approved JSON exactly. Each entry must include:

- `id`
- `name`
- `canonicalName`
- `mainMuscle`
- `aliases`
- `technicalNotes`
- `bundledAssetId`

Validation rejects:

- count different from 74;
- empty required fields;
- duplicate `id`, `canonicalName`, or `bundledAssetId`;
- unsupported muscle group;
- `technicalNotes` not starting with the exact approved prefix `Músculo principal:`;
- missing local bundled asset for any `bundledAssetId`.

The implementation keeps the annex text as-is.

## Catalog Helpers

Add pure helpers near the manifest or in a small companion module:

- `getSinfulShellExerciseById(id)`
- `searchSinfulShellExercises(query, muscle)`
- `validateSinfulShellCatalog()`
- `findCatalogCopyForSinfulShell(catalog, sinfulShellId)`
- `sinfulShellExerciseToLockedCatalogDraft(exercise, editableInput)`

Search text includes `name`, `canonicalName`, `mainMuscle`, `aliases`, and `bundledAssetId`. Muscle filters use the existing `MuscleGroup` values and the current `normalizeMuscleGroup` behavior.

## Personal Catalog Model

Extend `ExerciseCatalogItem` with optional fields:

```ts
origin?: 'user' | 'sinful-shell'
sinfulShellId?: string | null
sinfulShellContentLocked?: boolean
```

Legacy items without these fields are interpreted as:

```ts
origin: 'user'
sinfulShellId: null
sinfulShellContentLocked: false
```

These fields are not indexed. Dexie `CURRENT_SCHEMA_VERSION` does not change.

Zod import/export schemas accept the fields as optional and default them to the legacy interpretation. New backups preserve origin, `sinfulShellId`, and lock state.

## Services

Extend catalog input into explicit modes:

- manual create/update, current behavior;
- `create-from-sinful-shell`, with `sinfulShellId` plus only editable training fields.

For `create-from-sinful-shell`, `createCatalogExercise`:

1. Loads the Sinful Shell exercise by `sinfulShellId`.
2. Checks the personal catalog for an existing item with the same `sinfulShellId`.
3. If found, returns or signals that existing item instead of creating a duplicate.
4. Builds the catalog item using protected values from the manifest:
   - `name`
   - `canonicalName`
   - `mainMuscle`
   - `technicalNotes`
   - `bundledAssetId`
5. Persists editable fields from the form:
   - `equipment`
   - `loadMode`
   - `barWeightKg`
   - `warmupProtocol`
   - `aliases`
   - `defaultTargetSets`
   - `defaultRepsMin`
   - `defaultRepsMax`
   - `defaultRecommendedRir`
   - `defaultRestSeconds`
6. Sets:
   - `origin: 'sinful-shell'`
   - `sinfulShellId`
   - `sinfulShellContentLocked: true`

For locked Sinful Shell copies, `updateCatalogExercise` preserves protected fields from the existing item or manifest and only updates editable training configuration. Manual `origin: 'user'` items keep full editability.

Deleting a personal catalog copy does not touch the static manifest. The Sinful Shell browser then shows that exercise as available again.

`addCatalogExerciseToDay` already copies `bundledAssetId` from the personal catalog item to `RoutineExercise`; tests should lock this behavior in. `ensureExerciseLog` already snapshots `bundledAssetId`; tests should also lock this behavior in.

## UI Entries

In the Catalog tab:

- Add a compact banner above the personal catalog list.
- Copy: `Explorar Sinful Shell`.
- Show miniatures from the bundled assets, the count `74`, and a clear button.
- The existing personal catalog remains visible and editable below it.

In the current Add Exercise sheet for a routine:

- Keep the current personal catalog picker.
- Add a first-step choice/action area with:
  - `Agregar desde Sinful Shell`
  - `Crear ejercicio propio`
- `Agregar desde Sinful Shell` opens the shared Sinful Shell browser.
- `Crear ejercicio propio` opens the existing catalog editor for manual creation.

No separate route or full-screen wizard is introduced.

## Sinful Shell Bottom Sheet

Create a shared `SinfulShellBrowserSheet` component.

It is a bottom sheet within the existing 430px app shell, matching current sheet behavior:

- max height around `88vh`;
- sticky header with title, close button, and search;
- horizontal chips: `Todos`, `Pecho`, `Espalda`, `Hombros`, `Brazos`, `Abdomen`, `Piernas`;
- compact results in a stable grid/list that works at 360px;
- search by name and aliases;
- empty state for no matches;
- asset-missing state that still names the exercise and muscle;
- visible `Agregado` state for exercises with a personal copy.

Tapping a result opens the detail view inside the same sheet instead of importing.

## Detail View

The detail view shows:

- large exercise image;
- name;
- main muscle chip;
- aliases, when present;
- full read-only technical notes, starting with `Músculo principal:`;
- status: `Disponible` or `Ya agregado`;
- primary action `Agregar a mi catalogo` when no copy exists;
- actions `Ver en mi catalogo` and, when launched from a routine day, `Agregar a la rutina` when a copy exists;
- secondary action to go back to the browser or close.

Internal fields `id`, `canonicalName`, and `bundledAssetId` are not shown to the user.

## Finalization Editor

After `Agregar a mi catalogo`, open the existing `CatalogExerciseEditorSheet` in mode `create-from-sinful-shell`.

The editor shows a fixed read-only header before editable fields:

- image;
- name;
- main muscle;
- technical notes.

Protected controls are disabled or rendered read-only with a short explanation:

`Sinful Shell bloquea nombre, musculo, imagen e indicaciones tecnicas.`

Editable fields remain:

- equipment;
- load mode;
- bar weight when applicable;
- warmup protocol;
- aliases;
- default target sets;
- default rep range;
- default RIR;
- default rest seconds.

Technical notes are not editable for Sinful Shell copies.

When editing an existing personal catalog copy with `origin: 'sinful-shell'`, the same protected-field behavior applies. Items with `origin: 'user'` retain complete editability.

## Error And Empty States

Provide useful states for:

- no search matches;
- missing bundled asset;
- inconsistent manifest validation;
- detail not found;
- duplicate copy already exists;
- save failure.

No result card or detail view may render empty.

## Accessibility And Mobile

The browser and editor must keep:

- labelled search input;
- `aria-pressed` or equivalent selected state on muscle chips;
- labelled close/back buttons;
- clear status text for `Agregado`, `Disponible`, and `Ya agregado`;
- touch targets consistent with the current app;
- stable tracks and truncation for long names at 360px.

Use existing Tailwind theme tokens from `src/styles.css`; do not introduce raw component colors.

## Tests

Required coverage:

- manifest has exactly 74 entries and seven required fields per entry;
- all technical notes start with the approved prefix;
- every `bundledAssetId` exists in the bundled asset registry;
- search and muscle filter include names and aliases;
- card tap opens detail and does not import;
- detail shows image, name, muscle, aliases, notes, and status;
- `Agregar a mi catalogo` opens the finalization editor;
- service creates Sinful Shell copies from manifest values, not trusted form values;
- duplicate `sinfulShellId` does not create a second copy;
- locked updates preserve name, canonical name, muscle, bundled asset, and technical notes;
- manual catalog items remain fully editable;
- deleting a copy does not affect static availability;
- `bundledAssetId` propagates to routine exercises and exercise snapshots;
- Zod import/export accepts legacy backups and preserves new origin/lock fields;
- UI shows useful empty/error states.

Final verification:

- `pnpm test`
- `pnpm build`
