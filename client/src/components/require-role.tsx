import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useAuthStore } from '@/features/auth/auth.store'

type Props = { role: 'candidate' | 'employer'; message: string; children: ReactNode }

/** Waits for the session check, sends anonymous visitors to /login and blocks other roles. */
export function RequireRole({ role, message, children }: Props) {
  const status = useAuthStore((s) => s.status)
  const userRole = useAuthStore((s) => s.user?.role)

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (userRole !== role) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">{message}</p>
      </main>
    )
  }
  return <>{children}</>
}
