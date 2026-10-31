import { z } from 'zod'

const years = z
  .number()
  .min(0)
  .max(60)
  .transform((n) => Math.round(n * 100) / 100)

const text = (max: number) => z.string().trim().min(1).max(max)

const termId = (kind: string) => z.string().regex(new RegExp(`^${kind}:[a-z0-9-]+$`), `Invalid ${kind}`)

export const profileContentSchema = z.object({
  headline: z.string().trim().max(120).default(''),
  skills: z
    .array(z.object({ termId: termId('skill'), level: z.number().int().min(1).max(5), years }))
    .max(50),
  roles: z
    .array(z.object({ title: text(100), years, domainId: termId('domain').optional() }))
    .max(30),
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
