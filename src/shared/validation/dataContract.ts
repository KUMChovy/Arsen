import { z } from 'zod'

export const DATA_CONTRACT_VERSION = 1

export const trainingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const time = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
}, 'La fecha no es válida')

export const timestampSchema = z.string().datetime({ offset: true })
export const weightUnitSchema = z.enum(['kg', 'lb'])
export const sessionStatusSchema = z.enum(['draft', 'completed'])
export const imageAssetInputSchema = z.object({
  name: z.string(),
  mimeType: z.string().regex(/^image\/[A-Za-z0-9.+-]+$/),
  dataUrl: z.string(),
}).refine(({ mimeType, dataUrl }) => {
  const prefix = `data:${mimeType};base64,`
  if (!dataUrl.startsWith(prefix)) return false
  const data = dataUrl.slice(prefix.length)
  return data.length > 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data) && btoa(atob(data)) === data
}, 'La imagen no coincide con su tipo o no es válida')
export const recordedSetValuesSchema = z.object({
  weightKg: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  reps: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  rir: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  order: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  displayUnit: weightUnitSchema,
})
export const recordedMainOrWarmupSetValuesSchema = recordedSetValuesSchema.extend({ kind: z.enum(['main', 'warmup']) })
