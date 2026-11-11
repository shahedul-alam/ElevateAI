import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PENDING_EMAIL_KEY } from '@/features/auth/auth.api'
import { useAuthStore } from '@/features/auth/auth.store'

function pendingEmail() {
  try {
    return localStorage.getItem(PENDING_EMAIL_KEY)
  } catch {
    return null
  }
}

// Better Auth redirects here after an emailed link is opened; a failure adds ?error=<code>.
// ?change=1 marks the change-email flow, whose two links (approve, then verify) both land here, so
// the copy is decided by whether the signed-in address has actually changed yet.
export default function VerifyEmail() {
  const [params] = useSearchParams()
  const status = useAuthStore((s) => s.status)
  const email = useAuthStore((s) => s.user?.email)
  const failed = params.has('error')
  const isChange = params.get('change') === '1'
  // Read once: clearing it must not change the text on a re-render.
  const [pending] = useState(() => (isChange ? pendingEmail() : null))
  const done = isChange && !failed && !!pending && email === pending

  useEffect(() => {
    if (!done) return
    try {
      localStorage.removeItem(PENDING_EMAIL_KEY)
    } catch {}
  }, [done])

  if (isChange && !failed && status === 'loading') return null

  let title = 'Email verified'
  let text = 'Your email is confirmed. You are good to go.'
  if (failed) {
    title = 'Verification failed'
    text = 'This link is invalid or has expired. Log in and we will send you a new one.'
  } else if (done) {
    title = 'Email changed'
    text = `Your email is now ${email}.`
  } else if (isChange) {
    title = 'Change approved'
    text = pending
      ? `Now open the verification link we sent to ${pending}. Your email stays ${email ?? 'the same'} until you do.`
      : `If this was the approval link, open the verification link we sent to your new address. Your email stays ${email ?? 'the same'} until then.`
  }

  return (
    <main className="mx-auto flex max-w-md justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link to={failed ? '/login' : '/'} className="text-sm text-foreground underline">
            {failed ? 'Go to log in' : 'Continue to ElevateAI'}
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
