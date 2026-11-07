import { z } from 'zod'

// What the model must return, and what is stored.
export const explanationSchema = z.object({
  summary: z.string().max(400),
  steps: z.array(z.object({ focus: z.string().max(60), action: z.string().max(300) })).max(5),
})

export type GapExplanationResult = z.infer<typeof explanationSchema>
