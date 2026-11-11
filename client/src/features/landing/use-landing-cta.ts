import { useAuthStore } from '@/features/auth/auth.store'

type Cta = { label: string; to: string }

/** Role-aware calls to action. `loading` is true until the session is known: render them `invisible` so the space is kept. */
export function useLandingCta(): { primary: Cta; secondary: Cta; signedIn: boolean; loading: boolean } {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.status) === 'loading'
  return { ...pick(user?.role), loading }
}

function pick(role?: string): { primary: Cta; secondary: Cta; signedIn: boolean } {
  const user = role ? { role } : null
  if (user?.role === 'employer') {
    return {
      primary: { label: 'Post a job', to: '/employer/jobs/new' },
      secondary: { label: 'Review applicants', to: '/employer/hiring' },
      signedIn: true,
    }
  }
  if (user?.role === 'admin') {
    return {
      primary: { label: 'Open admin', to: '/admin' },
      secondary: { label: 'Browse jobs', to: '/jobs' },
      signedIn: true,
    }
  }
  if (user) {
    return {
      primary: { label: 'Open your dashboard', to: '/dashboard' },
      secondary: { label: 'Browse jobs', to: '/jobs' },
      signedIn: true,
    }
  }
  return {
    primary: { label: 'Create your profile', to: '/register' },
    secondary: { label: 'Browse jobs', to: '/jobs' },
    signedIn: false,
  }
}
