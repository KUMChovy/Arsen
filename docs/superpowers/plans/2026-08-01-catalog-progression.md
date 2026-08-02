# Catalog Progression Plan

Goal: keep double progression as the only progression system in Arsen and remove configurable progression strategies.

## Steps

- Remove progression strategy types and fields from routine/catalog domain types.
- Remove strategy inputs from catalog create/edit services and UI.
- Replace the catalog strategy selector with fixed copy explaining `Progresion doble`.
- Keep recommendation logic centered on repsMin, repsMax, target sets, current weight, and target RIR.
- Strip legacy `RoutineExercise.progression` and catalog `progressionStrategy` during import/export.
- Migrate existing IndexedDB data by deleting legacy catalog strategy values.
- Update seed/demo/generated backup to schema 3 without strategy fields.
- Verify with targeted tests, full tests, build, and UI detector.
