import { z } from 'zod'

const years = z
  .number()
  .min(0)
  .max(60)
  .transform((n) => Math.round(n * 100) / 100)

const text = (max: number) => z.string().trim().min(1).max(max)

const optionalText = (max: number) => z.string().trim().max(max).default('')

const termId = (kind: string) => z.string().regex(new RegExp(`^${kind}:[a-z0-9-]+$`), `Invalid ${kind}`)

export const profileContentSchema = z.object({
  headline: z.string().trim().max(120).default(''),
  summary: z.string().trim().max(2000).default(''),
  skills: z
    .array(z.object({ termId: termId('skill'), level: z.number().int().min(1).max(5), years }))
    .max(50),
  roles: z
    .array(
      z.object({
        title: text(100),
        years,
        domainId: termId('domain').optional(),
        // Shown to employers; never read by the scoring engine.
        company: optionalText(100),
        period: optionalText(60),
        description: optionalText(2000),
      }),
    )
    .max(30),
  // degreeLevel: 1 diploma/associate, 2 bachelor, 3 master, 4 doctorate. The highest one is scored;
  // field, institution and period are for display.
  education: z
    .array(
      z.object({
        degreeLevel: z.number().int().min(1).max(4),
        field: optionalText(100),
        institution: optionalText(100),
        period: optionalText(60),
      }),
    )
    .max(10)
    .default([]),
  leadershipLevel: z.number().int().min(0).max(3),
  certIds: z.array(termId('certification')).max(30),
  // Skills the candidate typed that are not in the catalog yet. Shown, never scored.
  unmapped: z.array(text(60)).max(20).default([]),
  preferences: z
    .object({
      locations: z.array(text(80)).max(10).default([]),
      workModes: z.array(z.enum(['onsite', 'hybrid', 'remote'])).max(3).default([]),
      minSalary: z.number().int().min(0).max(100_000_000).optional(),
    })
    .default({ locations: [], workModes: [] }),
})

export type ProfileInput = z.infer<typeof profileContentSchema>

/** Stored versions predate later fields, so reading re-applies the schema defaults. */
export const parseStoredProfile = (content: unknown): ProfileInput => profileContentSchema.parse(content)
