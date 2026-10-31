import { z } from 'zod'

export const catalogQuerySchema = z.object({
  kind: z.enum(['skill', 'certification', 'domain']),
  q: z.string().trim().max(60).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CatalogQuery = z.infer<typeof catalogQuerySchema>
