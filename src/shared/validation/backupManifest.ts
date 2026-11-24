import { z } from 'zod'
import { DATA_CONTRACT_VERSION } from './dataContract'
import { healthSummarySchema } from './healthSchemas'

export const backupManifestSchema = z.object({
  version: z.literal(DATA_CONTRACT_VERSION),
  tables: z.record(z.unknown()),
  assets: z.array(z.object({ id: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
  health: z.array(z.object({ sessionId: z.string().min(1), summary: healthSummarySchema.optional(), history: z.array(healthSummarySchema).optional() }).strict().refine((item) => Boolean(item.summary || item.history?.length))),
}).strict()
