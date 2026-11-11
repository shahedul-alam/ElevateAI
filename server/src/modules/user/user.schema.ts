import { z } from 'zod'

export const emailNotificationsSchema = z.object({ enabled: z.boolean() })
