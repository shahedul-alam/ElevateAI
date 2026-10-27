import { z } from 'zod'

// Mirrors server/src/modules/auth/auth.schema.ts so errors show before a request is sent.
export const SIGNUP_ROLES = ['candidate', 'employer'] as const

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a digit'),
  role: z.enum(SIGNUP_ROLES, 'Choose candidate or employer'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type Role = RegisterInput['role']

// No strength rules on login: only check the shape, the credentials decide.
export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>
