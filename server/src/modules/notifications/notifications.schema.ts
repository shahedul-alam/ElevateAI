import { z } from 'zod'

export const notificationsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>
