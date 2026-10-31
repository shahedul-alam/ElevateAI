import { z } from 'zod'

export const recommendQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type RecommendQuery = z.infer<typeof recommendQuerySchema>
