import { z } from 'zod'

const imageUrl = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
})

export const catalogImageSchema = z.object({
  url: imageUrl,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
}).strict()

const publishedExercise = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  name: z.string().trim().min(1).max(200),
  canonicalName: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  mainMuscle: z.enum(['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas']),
  aliases: z.array(z.string().trim().min(1).max(200)).max(100),
  technicalNotes: z.string().trim().min(1).max(10000),
  image: catalogImageSchema,
}).strict()

export const publishedCatalogSchema = z.object({
  version: z.number().int().positive().safe(),
  exercises: z.array(publishedExercise).max(10000),
}).strict().refine(({ exercises }) => new Set(exercises.map((exercise) => exercise.id)).size === exercises.length, {
  message: 'El catálogo contiene identificadores duplicados',
  path: ['exercises'],
})

export type PublishedCatalog = z.infer<typeof publishedCatalogSchema>
