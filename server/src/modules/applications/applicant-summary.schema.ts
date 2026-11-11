import { z } from 'zod'

export const summarySchema = z.object({ summary: z.string().max(600) })
