import { api } from '@/lib/api'
import type { AuthUser } from './auth.store'
import type { LoginInput, RegisterInput } from './auth.schema'

export async function registerRequest(input: RegisterInput) {
  const { data } = await api.post<{ user: AuthUser }>('/auth/register', input)
  return data.user
}

export async function signOutRequest() {
  await api.post('/auth/sign-out')
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser }>('/me')
  return data.user
}

export async function loginRequest(input: LoginInput) {
  const { data } = await api.post<{ user: AuthUser }>('/auth/login', input)
  return data.user
}
