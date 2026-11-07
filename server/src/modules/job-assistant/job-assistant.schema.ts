import { z } from 'zod'

export const draftInputSchema = z.object({
  text: z.string().trim().min(20, 'Paste at least a few sentences').max(12_000, 'Keep it under 12,000 characters'),
})

// What the model must return. Free text only: skill ids are resolved against the catalog afterwards.
const list = z.array(z.string().max(300)).max(20)

export const draftOutputSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(5000),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', '']),
  responsibilities: list,
  qualifications: list,
  perks: list,
  otherDetails: list,
  skills: z.array(z.object({ name: z.string().max(60), required: z.boolean() })).max(40),
})

export type DraftOutput = z.infer<typeof draftOutputSchema>
