import { api } from '@/lib/api'
import type { AuthUser } from './auth.store'
import type { LoginInput, RegisterInput } from './auth.schema'

export async function registerRequest(input: RegisterInput) {
  const { data } = await api.post<{ user: AuthUser; verificationRequired: boolean }>(
    '/auth/register',
    input,
  )
  return data
}

/** Records agreement to the AI privacy notice (sending text to OpenAI for the AI features). */
export async function setAiConsentRequest() {
  await api.post('/me/ai-consent')
}

export async function withdrawAiConsentRequest() {
  await api.delete('/me/ai-consent')
}

export async function setEmailNotificationsRequest(enabled: boolean) {
  const { data } = await api.put<{ emailNotifications: boolean }>('/me/email-notifications', { enabled })
  return data.emailNotifications
}

export const PENDING_EMAIL_KEY = 'pendingEmail'

const callback =(path: string) => `${window.location.origin}${path}`

export async function requestPasswordResetRequest(email: string) {
  await api.post('/auth/request-password-reset', { email, redirectTo: callback('/reset-password') })
}

export async function resetPasswordRequest(input: { token: string; newPassword: string }) {
  await api.post('/auth/reset-password', input)
}

export async function changeEmailRequest(newEmail: string) {
  await api.post('/auth/change-email', { newEmail, callbackURL: callback('/verify-email?change=1') })
}

export async function resendVerificationRequest(email: string) {
  await api.post('/auth/send-verification-email', { email, callbackURL: callback('/verify-email') })
}

/** Starts Google sign-in. A role means "create the account if new" (/register); without one only existing users get in. */
export async function googleSignIn(role?: 'candidate' | 'employer') {
  const { data } = await api.post<{ url: string }>('/auth/sign-in/social', {
    provider: 'google',
    callbackURL: callback('/'),
    errorCallbackURL: callback(role ? '/register' : '/login'),
    requestSignUp: !!role,
    additionalData: role ? { role } : undefined,
  })
  window.location.assign(data.url)
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
