import { z } from 'zod'

const years = z.number().min(0).max(60).transform((n) => Math.round(n * 100) / 100)
const termId = (kind: string) => z.string().regex(new RegExp(`^${kind}:[a-z0-9-]+$`), `Invalid ${kind}`)

export const jobContentSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    description: z.string().trim().min(1, 'Description is required').max(5000),
    skills: z
      .array(
        z.object({
          termId: termId('skill'),
          required: z.boolean(),
          minLevel: z.number().int().min(1).max(5),
          minYears: years.optional(),
        }),
      )
      .max(30),
    minYears: years,
    domainId: termId('domain').optional(),
    minDomainYears: years,
    leadershipLevel: z.number().int().min(0).max(3),
    certIds: z.array(termId('certification')).max(30),
    location: z.string().trim().max(80).optional(),
    workMode: z.enum(['onsite', 'hybrid', 'remote']).optional(),
    salaryMin: z.number().int().min(0).max(100_000_000).optional(),
    salaryMax: z.number().int().min(0).max(100_000_000).optional(),
  })
  .refine((j) => j.salaryMin === undefined || j.salaryMax === undefined || j.salaryMin <= j.salaryMax, {
    path: ['salaryMax'],
    message: 'Maximum salary must be at least the minimum',
  })

export type JobInput = z.infer<typeof jobContentSchema>

export const jobIdParamSchema = z.object({ id: z.uuid() })

export const jobListQuerySchema = z.object({
  q: z.string().trim().max(80).default(''),
  workMode: z.enum(['onsite', 'hybrid', 'remote']).optional(),
  domainId: termId('domain').optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type JobListQuery = z.infer<typeof jobListQuerySchema>
