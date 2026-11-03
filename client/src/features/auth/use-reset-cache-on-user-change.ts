import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useAuthStore } from './auth.store'
import { SESSION_KEY } from './use-session'

/**
 * Drops every cached query (except the session itself) when the signed-in user changes: sign-out,
 * sign-in as someone else, or a session that expired. Without this, one user's cached data (their
 * company, profile, applications) stays in memory and a disabled query keeps serving it to the next
 * user of the same tab.
 */
export function useResetCacheOnUserChange() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const status = useAuthStore((s) => s.status)
  const previous = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Wait for the first verdict: the initial "loading" is not a change of user.
    if (status === 'loading') return
    if (previous.current !== undefined && previous.current !== userId) {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] })
    }
    previous.current = userId
  }, [userId, status, queryClient])
}
