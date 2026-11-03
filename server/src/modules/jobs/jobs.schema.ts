import { z } from 'zod'

const years = z.number().min(0).max(60).transform((n) => Math.round(n * 100) / 100)
const termId = (kind: string) => z.string().regex(new RegExp(`^${kind}:[a-z0-9-]+$`), `Invalid ${kind}`)

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship'] as const

/** Free-text bullet list; defaults to empty so versions saved before these fields still parse. */
const textList = z.array(z.string().trim().min(1, 'Cannot be blank').max(300)).max(20).default([])

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
    // 0 not required, 1 diploma/associate, 2 bachelor, 3 master, 4 doctorate.
    minDegreeLevel: z.number().int().min(0).max(4).default(0),
    leadershipLevel: z.number().int().min(0).max(3),
    certIds: z.array(termId('certification')).max(30),
    location: z.string().trim().max(80).optional(),
    workMode: z.enum(['onsite', 'hybrid', 'remote']).optional(),
    salaryMin: z.number().int().min(0).max(100_000_000).optional(),
    salaryMax: z.number().int().min(0).max(100_000_000).optional(),
    // Display-only fields below: never read by the matching engine.
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    applicationDeadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine((d) => {
        const parsed = new Date(`${d}T00:00:00Z`)
        // An out-of-range month or day is an Invalid Date, and toISOString() would throw on it.
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(d)
      }, 'Invalid date')
      .optional(),
    responsibilities: textList,
    qualifications: textList,
    perks: textList,
    otherDetails: textList,
  })
  .refine((j) => j.salaryMin === undefined || j.salaryMax === undefined || j.salaryMin <= j.salaryMax, {
    path: ['salaryMax'],
    message: 'Maximum salary must be at least the minimum',
  })

export type JobInput = z.infer<typeof jobContentSchema>

/** Stored versions predate later fields, so reading re-applies the schema defaults. */
export const parseStoredJob = (content: unknown): JobInput => jobContentSchema.parse(content)

export const jobIdParamSchema = z.object({ id: z.uuid() })

export const jobListQuerySchema = z.object({
  q: z.string().trim().max(80).default(''),
  workMode: z.enum(['onsite', 'hybrid', 'remote']).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  domainId: termId('domain').optional(),
  companyId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type JobListQuery = z.infer<typeof jobListQuerySchema>
