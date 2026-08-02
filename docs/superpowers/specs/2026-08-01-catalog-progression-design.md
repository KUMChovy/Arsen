# Catalog Progression Design

## Decision

Arsen supports one progression system across the whole app: double progression. The app no longer stores or exposes a selectable progression strategy on routine exercises or catalog exercises.

## Behavior

- Routine exercises keep the day recipe: sets, repsMin, repsMax, target RIR, rest, current weight, warmups, and notes.
- Catalog exercises keep defaults for that recipe.
- Weight increase recommendations always use double progression: if every main set reaches repsMax with the target RIR or easier, Arsen recommends increasing weight and returning to repsMin.
- Drop sets do not count for the recommendation.
- Old backups may contain legacy progression fields. Imports accept the file, strip those fields, and persist only the current double-progression data.

## User Communication

The catalog editor shows a fixed information block named `Progresion doble`. It tells the user that Arsen always recommends increasing weight when the maximum rep target is completed across all sets with the target RIR.

This is informational only. There is no selector, no hidden alternative mode, and no weekly pattern configuration.

## Verification

- Schema migration removes legacy catalog strategy data.
- Import/export strips legacy routine and catalog progression fields.
- Demo seed and generated demo backup use schema 3 and preserve only double-progression-compatible data.
- `/rutina`, `/entreno`, and `/progreso` do not depend on a configurable progression field.
