import { z } from 'zod'

const score = z.number().int().min(0).max(100)
const list = (max: number, len: number) => z.array(z.string().max(len)).max(max)

// What the model must return. The overall score is computed by buildEvaluation, not the model.
export const rawEvaluationSchema = z.object({
  scores: z.object({
    skills: score,
    impact: score,
    structure: score,
    clarity: score,
    completeness: score,
  }),
  strengths: list(5, 300),
  weaknesses: list(5, 300),
  keywords: list(10, 60),
})

export type RawEvaluation = z.infer<typeof rawEvaluationSchema>

export type Evaluation = RawEvaluation & { overall: number }
