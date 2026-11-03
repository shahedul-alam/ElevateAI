import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { STATUS_LABEL } from '@/features/applications/applications.api'
import { useApply } from '@/features/applications/use-applications'
import { useAuthStore } from '@/features/auth/auth.store'
import { getApiError } from '@/lib/api'
import { MatchBreakdown } from './match-breakdown'
import { useGap } from './use-matching'

/** "How you match" card on a job page: live gap view for candidates, plus applying. */
export function MatchPanel({
  jobId,
  jobTitle,
  companyName,
}: {
  jobId: string
  jobTitle?: string
  companyName?: string
}) {
  const authStatus = useAuthStore((s) => s.status)
  const role = useAuthStore((s) => s.user?.role)
  const isCandidate = role === 'candidate'
  const gap = useGap(jobId, isCandidate)
  const apply = useApply()
  const [confirming, setConfirming] = useState(false)

  if (authStatus === 'loading') return null
  if (authStatus === 'anonymous') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>How you match</CardTitle>
          <CardDescription>
            <Link to="/login" className="underline">
              Log in
            </Link>{' '}
            as a candidate to see your match score and apply.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  if (!isCandidate) return null

  if (gap.isPending) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Calculating your match...</p>
        </CardContent>
      </Card>
    )
  }
  if (gap.isError) {
    const { status, message } = getApiError(gap.error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>How you match</CardTitle>
          <CardDescription>
            {status === 409 ? (
              <>
                {message}.{' '}
                <Link to="/resume" className="underline">
                  Go to your resume
                </Link>
              </>
            ) : (
              'Could not calculate your match. Try again in a moment.'
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { score, application } = gap.data

  const onApply = () =>
    apply.mutate(jobId, {
      onSuccess: (a) => toast.success('Application sent', { description: `Your match score was ${a.matchScore}%.` }),
      onError: (err) => toast.error('Could not apply', { description: getApiError(err).message }),
      onSettled: () => setConfirming(false),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          How you match: <span data-testid="live-score">{score}%</span>
        </CardTitle>
        <CardDescription>
          Based on your current resume. The same resume always gives the same score.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <MatchBreakdown {...gap.data} label="Your match" />

        {application ? (
          <div role="status" className="rounded-lg border p-3 text-sm">
            <p className="font-medium">
              You applied on {new Date(application.createdAt).toLocaleDateString()} ·{' '}
              {STATUS_LABEL[application.status]}
            </p>
            <p className="text-muted-foreground">
              Your score when you applied: {application.matchScore}%. It stays fixed even if you edit your
              resume.
            </p>
          </div>
        ) : (
          <>
            <Button onClick={() => setConfirming(true)} disabled={apply.isPending} className="self-start">
              Apply with your current resume
            </Button>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={jobTitle ? `Apply to ${jobTitle}?` : 'Submit your application?'}
              description={
                <>
                  <p>
                    Your current resume will be sent to {companyName ?? 'the employer'}. Your match score right
                    now is <strong>{score}%</strong>.
                  </p>
                  <p className="mt-2">
                    That score stays fixed on your application even if you edit your resume later. An
                    application cannot be withdrawn.
                  </p>
                </>
              }
              confirmLabel="Submit application"
              pendingLabel="Applying..."
              pending={apply.isPending}
              onConfirm={onApply}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
