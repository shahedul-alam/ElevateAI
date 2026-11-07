import { create } from 'zustand'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: 'candidate' | 'employer' | 'admin'
  emailVerified?: boolean
  /** Agreed to the current AI privacy notice. */
  aiConsent?: boolean
}

// `loading` until the first GET /api/me settles, so the UI does not flash the logged-out state.
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  user: AuthUser | null
  status: AuthStatus
  setUser: (user: AuthUser) => void
  clearUser: () => void
  settleAnonymous: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: 'loading',
  setUser: (user) => set({ user, status: 'authenticated' }),
  clearUser: () => set({ user: null, status: 'anonymous' }),
  // First check failed without a verdict (network/5xx): stop loading, but keep any known user.
  settleAnonymous: () =>
    set((s) => (s.status === 'loading' ? { status: 'anonymous' } : s)),
}))
