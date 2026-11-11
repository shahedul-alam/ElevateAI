import { z } from 'zod'
import { AUDIT_ACTIONS } from './admin.audit'

const flag = z.enum(['true', 'false']).transform((v) => v === 'true')

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  role: z.enum(['candidate', 'employer', 'admin']).optional(),
  suspended: flag.optional(),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const adminJobsQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['draft', 'active', 'closed']).optional(),
  suspended: flag.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const suspensionSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason (at least 3 characters)').max(500),
})

export const adminAuditQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  action: z.enum(AUDIT_ACTIONS).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const deleteUserSchema = z.object({ confirmEmail: z.string().trim().min(1).max(320) })

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>
export type AdminJobsQuery = z.infer<typeof adminJobsQuerySchema>
