import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { getApiError } from '@/lib/api'
import { setAiConsentRequest } from './auth.api'
import { useAuthStore } from './auth.store'
import { SESSION_KEY } from './use-session'

/** True when the server refused an AI call because the user has not agreed to the AI privacy notice. */
export const isConsentError = (err: unknown) => {
  const e = getApiError(err)
  return e.status === 403 && e.details.some((d) => d.field === 'aiConsent')
}

/**
 * Asks once for agreement to send text to OpenAI before an AI action. `withAiConsent(action)` runs the
 * action straight away if the user already agreed, otherwise shows `consentDialog` first and runs it after
 * "Agree". `retryOnConsentError` covers a stale client state: the server said no, so ask and retry.
 */
export function useAiConsent() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [saving, setSaving] = useState(false)

  const withAiConsent = (action: () => void) => (user?.aiConsent ? action() : setPending(() => action))

  /** Returns true (and opens the dialog) when `err` is a missing-consent refusal. */
  const retryOnConsentError = (err: unknown, retry: () => void) => {
    if (!isConsentError(err)) return false
    setPending(() => retry)
    return true
  }

  const agree = async () => {
    if (!pending || !user) return
    setSaving(true)
    try {
      await setAiConsentRequest()
      setUser({ ...user, aiConsent: true })
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY })
      const action = pending
      setPending(null)
      action()
    } catch (err) {
      toast.error('Could not save your choice', { description: getApiError(err).message })
    } finally {
      setSaving(false)
    }
  }

  const consentDialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title="Use AI features?"
      description={
        <>
          <p>
            To do this, ElevateAI sends the text you provide (your resume details, or the job text you paste) to
            OpenAI, which writes the result. Your contact details, photo, and employers&apos; private notes and
            ratings are never sent. AI never decides who is ranked, shown or rejected.
          </p>
          <p className="mt-2">
            If you apply to a job, an AI-written summary of your resume can be shown to that employer. You can
            withdraw at any time from your account page. Read the full{' '}
            <Link to="/privacy" target="_blank" className="underline">
              AI privacy notice
            </Link>
            .
          </p>
        </>
      }
      confirmLabel="Agree and continue"
      pendingLabel="Saving..."
      pending={saving}
      onConfirm={agree}
    />
  )

  return { withAiConsent, retryOnConsentError, consentDialog }
}
