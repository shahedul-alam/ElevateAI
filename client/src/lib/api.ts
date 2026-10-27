import axios, { isAxiosError } from 'axios'

import { useAuthStore } from '@/features/auth/auth.store'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export type ApiErrorDetail = { field: string; message: string }

export type ApiError = {
  status: number | null
  message: string
  details: ApiErrorDetail[]
}

type ErrorBody = { error?: { message?: string; details?: ApiErrorDetail[] } }

/** Normalises any thrown value into the server's `{ error: { message, details } }` shape. */
export function getApiError(err: unknown): ApiError {
  if (isAxiosError<ErrorBody>(err)) {
    if (!err.response) {
      return {
        status: null,
        message: 'Cannot reach the server. Check your connection and try again.',
        details: [],
      }
    }
    const body = err.response.data?.error
    return {
      status: err.response.status,
      message: body?.message ?? 'Something went wrong. Please try again.',
      details: body?.details ?? [],
    }
  }
  return { status: null, message: 'Something went wrong. Please try again.', details: [] }
}

// A 401 from a protected call means the session ended: drop the user. /auth/* and /me decide it themselves.
api.interceptors.response.use(undefined, (err: unknown) => {
  if (isAxiosError(err) && err.response?.status === 401) {
    const url = err.config?.url ?? ''
    if (!url.startsWith('/auth/') && url !== '/me') useAuthStore.getState().clearUser()
  }
  return Promise.reject(err)
})
