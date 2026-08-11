import type { MuscleGroup } from '../../domains/routine/types'
import { normalizeMuscleGroup } from '../../domains/routine/utils/muscles'
import { canonicalName } from '../utils/normalize'

export type BundledExerciseAsset = {
  aliases: string[]
  id: string
  muscle: MuscleGroup
  name: string
  url: string
}

const muscleSlugToGroup = {
  abdomen: 'Abdomen',
  brazos: 'Brazos',
  espalda: 'Espalda',
  hombros: 'Hombros',
  pecho: 'Pecho',
  piernas: 'Piernas',
} as const satisfies Record<string, MuscleGroup>

type MuscleSlug = keyof typeof muscleSlugToGroup

const groupToMuscleSlug: Record<MuscleGroup, MuscleSlug> = {
  Abdomen: 'abdomen',
  Brazos: 'brazos',
  Espalda: 'espalda',
  Hombros: 'hombros',
  Pecho: 'pecho',
  Piernas: 'piernas',
}

const exerciseModules = import.meta.glob('../../assets/ejercicios/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const muscleModules = import.meta.glob('../../assets/musculos/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const aliasesByBundledAssetId: Record<string, string[]> = {
  'jalon-al-pecho--espalda': ['jalon dorsal', 'polea alta'],
  'press-plano--pecho': ['press banca'],
  'sentadilla-trasera--piernas': ['back squat'],
}

export const bundledExerciseAssets = Object.entries(exerciseModules)
  .map(([path, url]) => parseExerciseAsset(path, url))
  .filter((asset): asset is BundledExerciseAsset => Boolean(asset))
  .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))

export const bundledMuscleAssets = Object.fromEntries(
  Object.entries(groupToMuscleSlug).map(([group, slug]) => [group, muscleModules[`../../assets/musculos/${slug}.png`] ?? '']),
) as Record<MuscleGroup, string>

const bundledAssetById = new Map(bundledExerciseAssets.map((asset) => [asset.id, asset]))

export function getBundledExerciseAsset(id: string | null | undefined) {
  return id ? bundledAssetById.get(id) ?? null : null
}

export function getMuscleAsset(muscle: string | null | undefined) {
  if (!muscle?.trim()) return null

  const normalized = normalizeMuscleGroup(muscle)
  return bundledMuscleAssets[normalized] || bundledMuscleAssets.Pecho || null
}

export function bundledAssetIdForExercise(name: string, muscle: string | null | undefined) {
  const normalized = normalizeMuscleGroup(muscle)
  const id = `${canonicalName(name)}--${groupToMuscleSlug[normalized]}`

  return bundledAssetById.has(id) ? id : null
}

export function searchableTextForBundledAsset(asset: BundledExerciseAsset) {
  return [asset.id, asset.name, asset.muscle, ...asset.aliases].join(' ').toLocaleLowerCase('es-MX')
}

export function validateBundledAssetRegistry() {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const path of Object.keys(exerciseModules)) {
    const filename = filenameFromPath(path)
    const match = /^(?<exerciseSlug>[a-z0-9]+(?:-[a-z0-9]+)*)--(?<muscleSlug>[a-z]+)\.png$/.exec(filename)
    if (!match?.groups) {
      errors.push(`Nombre invalido: ${filename}`)
      continue
    }

    const muscleSlug = match.groups.muscleSlug
    if (!muscleSlug || !isMuscleSlug(muscleSlug)) {
      errors.push(`Musculo invalido en ${filename}: ${muscleSlug ?? 'sin-musculo'}`)
    }

    const id = filename.replace(/\.png$/, '')
    if (ids.has(id)) errors.push(`bundledAssetId duplicado: ${id}`)
    ids.add(id)
  }

  for (const slug of Object.keys(muscleSlugToGroup)) {
    if (!muscleModules[`../../assets/musculos/${slug}.png`]) errors.push(`Falta fallback muscular: ${slug}.png`)
  }

  for (const id of Object.keys(aliasesByBundledAssetId)) {
    if (!ids.has(id)) errors.push(`Aliases apuntan a bundledAssetId inexistente: ${id}`)
  }

  return errors
}

function parseExerciseAsset(path: string, url: string): BundledExerciseAsset | null {
  const filename = filenameFromPath(path)
  const match = /^(?<exerciseSlug>[a-z0-9]+(?:-[a-z0-9]+)*)--(?<muscleSlug>[a-z]+)\.png$/.exec(filename)
  const exerciseSlug = match?.groups?.exerciseSlug
  const muscleSlug = match?.groups?.muscleSlug
  if (!exerciseSlug || !muscleSlug || !isMuscleSlug(muscleSlug)) return null

  const id = filename.replace(/\.png$/, '')
  return {
    aliases: aliasesByBundledAssetId[id] ?? [],
    id,
    muscle: muscleSlugToGroup[muscleSlug],
    name: titleFromSlug(exerciseSlug),
    url,
  }
}

function filenameFromPath(path: string) {
  return path.split(/[\\/]/).at(-1) ?? ''
}

function isMuscleSlug(value: string): value is MuscleSlug {
  return Object.hasOwn(muscleSlugToGroup, value)
}

function titleFromSlug(slug: string) {
  const text = slug.replaceAll('-', ' ')
  return text.charAt(0).toLocaleUpperCase('es-MX') + text.slice(1)
}
