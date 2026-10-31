import { expect, type APIRequestContext } from '@playwright/test'

export const PASSWORD = 'e2e-password-123'
export const ADMIN = { email: 'admin@e2e.test', password: 'e2e-admin-password-123' }
export const CLIENT_ORIGIN = 'http://localhost:5174'
export const SESSION_COOKIE = 'better-auth.session_token'

let counter = 0

export function uniqueEmail(prefix = 'user') {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}@e2e.test`
}

export type Role = 'candidate' | 'employer'

export type TestUser = { name: string; email: string; password: string; role: Role }

export function newUser(overrides: Partial<TestUser> = {}): TestUser {
  return { name: 'E2E User', email: uniqueEmail(), password: PASSWORD, role: 'candidate', ...overrides }
}

/** Registers through the API. The request context's cookie jar ends up signed in as this user. */
export async function registerUser(request: APIRequestContext, overrides: Partial<TestUser> = {}) {
  const user = newUser(overrides)
  const res = await request.post('/api/auth/register', { data: user })
  expect(res.status(), await res.text()).toBe(201)
  return user
}

/** Registers a user, then drops the session so the context is anonymous again. */
export async function createUser(request: APIRequestContext, overrides: Partial<TestUser> = {}) {
  const user = await registerUser(request, overrides)
  await request.post('/api/auth/sign-out', { headers: { Origin: CLIENT_ORIGIN } })
  return user
}

export async function sessionCookie(request: APIRequestContext) {
  const state = await request.storageState()
  return state.cookies.find((c) => c.name === SESSION_COOKIE)
}
