import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getApiError } from '@/lib/api'
import { fetchMe } from './auth.api'
import { useAuthStore } from './auth.store'

export const SESSION_KEY = ['me'] as const

/** Restores the signed-in user from the session cookie (GET /api/me). Call once, near the app root. */
export function useSession() {
  const { data, error, isError } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchMe,
    retry: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const { setUser, clearUser, settleAnonymous } = useAuthStore.getState()
    if (data) setUser(data)
    else if (isError) {
      if (getApiError(error).status === 401) clearUser()
      else settleAnonymous()
    }
  }, [data, error, isError])
}
