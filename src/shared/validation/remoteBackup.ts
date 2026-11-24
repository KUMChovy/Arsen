import { z } from 'zod'

const safeInteger = z.number().int().safe()

export const prepareRemoteBackupSchema = z.object({
  id: z.string().uuid(),
  contractVersion: safeInteger.positive(),
  localRevision: safeInteger.nonnegative(),
  baseBackupId: z.string().uuid().nullable(),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: safeInteger.positive(),
  includesHealth: z.boolean(),
  healthConsent: z.boolean(),
}).strict().refine((metadata) => !metadata.includesHealth || metadata.healthConsent, {
  message: 'Los datos de salud requieren consentimiento explícito',
  path: ['healthConsent'],
})
