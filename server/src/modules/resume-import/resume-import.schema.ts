import { z } from 'zod'

// What the model must return. Free text only: ids are resolved against the catalog afterwards.
// Lengths mirror profileContentSchema; mapExtraction re-validates anyway.
const str = (max: number) => z.string().max(max)

export const extractionSchema = z.object({
  headline: str(120),
  summary: str(2000),
  skills: z.array(z.object({ name: str(60), level: z.number().int().min(1).max(5), years: z.number().min(0).max(60) })).max(50),
  roles: z
    .array(
      z.object({
        title: str(100),
        company: str(100),
        period: str(60),
        description: str(2000),
        years: z.number().min(0).max(60),
        domain: str(60),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({
        degreeLevel: z.number().int().min(1).max(4),
        field: str(100),
        institution: str(100),
        period: str(60),
      }),
    )
    .max(10),
  certifications: z.array(str(100)).max(30),
})

export type Extraction = z.infer<typeof extractionSchema>
