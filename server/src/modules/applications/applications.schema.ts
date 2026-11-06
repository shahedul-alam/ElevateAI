import { z } from 'zod'

export const applicantsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type ApplicantsQuery = z.infer<typeof applicantsQuerySchema>

// The hiring stages in order; 'rejected' can follow any stage but the last.
export const PIPELINE = ['applied', 'under_review', 'technical_interview', 'culture_fit', 'offer', 'hired'] as const
const ALL_STATUSES = [...PIPELINE, 'rejected'] as const

// 'applied' is the starting state and can never be set again.
export const changeStatusSchema = z.object({
  status: z.enum(ALL_STATUSES.filter((s) => s !== 'applied') as Exclude<(typeof ALL_STATUSES)[number], 'applied'>[]),
})

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

export const employerApplicationsQuerySchema = applicantsQuerySchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(ALL_STATUSES).optional()),
  jobId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  minRating: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5).optional()),
})

export type EmployerApplicationsQuery = z.infer<typeof employerApplicationsQuerySchema>

export const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) })

export const ratingSchema = z.object({ rating: z.number().int().min(1).max(5).nullable() })
