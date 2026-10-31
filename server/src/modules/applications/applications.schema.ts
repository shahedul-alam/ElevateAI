import { z } from 'zod'

export const applicantsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type ApplicantsQuery = z.infer<typeof applicantsQuerySchema>

// 'applied' is the starting state and can never be set again.
export const changeStatusSchema = z.object({
  status: z.enum(['under_review', 'rejected', 'hired']),
})

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>
