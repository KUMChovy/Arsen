import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)
const entry = z.object({ id: slug, name: z.string().trim().min(1).max(200), canonicalName: slug, mainMuscle: z.enum(['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas']), aliases: z.array(z.string().trim().min(1).max(200)).max(100), technicalNotes: z.string().trim().min(1).max(10000), bundledAssetId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*--(?:pecho|espalda|hombros|brazos|abdomen|piernas)$/) }).strict()
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export async function prepareCatalogSeed(root) {
  const source = await readFile(join(root, 'src/domains/routine/data/sinfulShellCatalog.ts'), 'utf8')
  const start = 'export const sinfulShellCatalog: readonly SinfulShellExercise[] = '
  const match = source.split(start)
  if (match.length !== 2) throw new Error('No se pudo identificar el catálogo inicial')
  const parts = match[1].split(/\r?\n\r?\nconst sinfulShellById/)
  if (parts.length !== 2) throw new Error('No se pudo identificar el final del catálogo')
  const exercises = z.array(entry).length(74).parse(JSON.parse(parts[0]))
  if (new Set(exercises.map((item) => item.id)).size !== exercises.length) throw new Error('Identificadores duplicados')
  const prepared = []
  for (const item of exercises) {
    const relativePath = `src/assets/ejercicios/${item.bundledAssetId}.png`
    const bytes = await readFile(join(root, relativePath))
    if (bytes.length < 8 || bytes.length > 10 * 1024 * 1024 || !bytes.subarray(0, 8).equals(pngSignature)) throw new Error(`Imagen inválida para ${item.id}`)
    const { bundledAssetId: _asset, ...exercise } = item
    prepared.push({ ...exercise, image: { localPath: relativePath, sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length, mimeType: 'image/png' } })
  }
  return { format: 1, exercises: prepared }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const target = resolve('generated/arsen-catalog-seed-inventory.json')
  try {
    const inventory = await prepareCatalogSeed(process.cwd())
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, `${JSON.stringify(inventory, null, 2)}\n`, { flag: 'wx' })
    console.log(`Inventario preparado: ${inventory.exercises.length} ejercicios.`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo preparar el inventario')
    process.exitCode = 1
  }
}
