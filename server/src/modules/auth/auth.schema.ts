import { z } from 'zod'
import { SIGNUP_ROLES } from './auth.config'

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a digit'),
  role: z.enum(SIGNUP_ROLES, `Role must be one of: ${SIGNUP_ROLES.join(', ')}`),
})

export type RegisterInput = z.infer<typeof registerSchema>

// No strength rules on login: only check the shape, the credentials decide.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(128, 'Password must be at most 128 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>
