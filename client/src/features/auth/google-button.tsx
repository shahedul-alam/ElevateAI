import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { getApiError } from '@/lib/api'
import { googleSignIn } from './auth.api'
import type { Role } from './auth.schema'

const ENABLED = import.meta.env.VITE_GOOGLE_AUTH === 'true'

// Better Auth redirects back with ?error=<code> when the Google flow fails.
const ERRORS: Record<string, string> = {
  signup_disabled: 'No account uses this Google email yet. Sign up first.',
  'account_not_linked': 'An account with this email exists. Log in with your password and verify your email first.',
  'Account suspended': 'This account has been suspended by an administrator.',
}

/** Shows a toast for a failed Google redirect, once, and removes the param. */
function useOAuthError() {
  const [params, setParams] = useSearchParams()
  const error = params.get('error')
  useEffect(() => {
    if (!error) return
    toast.error('Google sign-in failed', { description: ERRORS[error] ?? 'Please try again.' })
    setParams((p) => (p.delete('error'), p), { replace: true })
  }, [error, setParams])
}

/** `role` set = sign-up (register page); unset = sign-in only (login page). */
export function GoogleButton({ role }: { role?: Role }) {
  useOAuthError()
  const [pending, setPending] = useState(false)
  if (!ENABLED) return null

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() => {
        setPending(true)
        googleSignIn(role).catch((err) => {
          setPending(false)
          toast.error('Google sign-in failed', { description: getApiError(err).message })
        })
      }}
    >
      {role ? 'Sign up with Google' : 'Continue with Google'}
    </Button>
  )
}
