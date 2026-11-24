import type { PublishedCatalog } from '../../shared/validation/remoteCatalog'
import { getSinfulShellExerciseById, type SinfulShellExercise } from './data/sinfulShellCatalog'

export function remoteCatalogExercises(snapshot: PublishedCatalog): SinfulShellExercise[] {
  return snapshot.exercises.map(({ image, ...exercise }) => ({
    ...exercise,
    bundledAssetId: getSinfulShellExerciseById(exercise.id)?.bundledAssetId ?? null,
    remoteImage: image,
    globalCatalogVersion: snapshot.version,
  }))
}
