import { catalogImageSchema, type PublishedCatalog } from '../validation/remoteCatalog'

type Image = PublishedCatalog['exercises'][number]['image']

export function catalogImageReference(raw: Image): string {
  const image = catalogImageSchema.parse(raw)
  return `global-image-v1:${image.sha256}:${image.sizeBytes}:${image.mimeType.slice('image/'.length)}`
}

export function parseCatalogImageReference(value: string | null | undefined): Image | null {
  const match = /^global-image-v1:([a-f0-9]{64}):([1-9][0-9]*):(png|jpeg|webp)$/.exec(value ?? '')
  if (!match) return null
  const parsed = catalogImageSchema.safeParse({
    url: 'https://arsen.invalid/image', sha256: match[1], sizeBytes: Number(match[2]), mimeType: `image/${match[3]}`,
  })
  return parsed.success ? parsed.data : null
}
