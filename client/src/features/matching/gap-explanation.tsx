import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAiConsent } from '@/features/auth/use-ai-consent'
import { getApiError } from '@/lib/api'
import { useExplainGap, useGapExplanation } from './use-matching'

/** Optional AI note on how to close the gap. Advice only: the score above is not affected. */
export function GapExplanationSection({ jobId }: { jobId: string }) {
  const query = useGapExplanation(jobId, true)
  const explain = useExplainGap(jobId)
  const { withAiConsent, retryOnConsentError, consentDialog } = useAiConsent()
  const data = query.data
  const explanation = data?.explanation

  const run = () =>
    withAiConsent(() =>
      explain.mutate(undefined, {
        onError: (err) => {
          if (!retryOnConsentError(err, run)) {
            toast.error('Could not explain', { description: getApiError(err).message })
          }
        },
      }),
    )

  return (
    <section aria-label="Gap explanation" className="flex flex-col gap-3 border-t pt-4">
      {consentDialog}
      {explanation ? (
        <>
          <p className="text-sm">{explanation.summary}</p>
          {explanation.steps.length > 0 && (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {explanation.steps.map((s) => (
                <li key={s.focus + s.action}>
                  <span className="font-medium">{s.focus}.</span> <span className="text-muted-foreground">{s.action}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            AI-written suggestion based on your resume and this job. It does not change your score.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={explain.isPending || query.isPending || data?.remainingToday === 0}
            onClick={run}
          >
            {explain.isPending ? 'Explaining...' : 'Explain this gap'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {data?.remainingToday === 0
              ? 'You have used all of today’s explanations.'
              : 'AI suggests how to close the gap. Your resume skills and this job’s requirements are sent to OpenAI. This can take up to a minute.'}{' '}
            <Link to="/privacy" className="underline">
              Privacy
            </Link>
          </p>
        </div>
      )}
    </section>
  )
}
