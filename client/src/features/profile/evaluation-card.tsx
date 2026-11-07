import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiError } from '@/lib/api'
import { EVAL_DIMENSIONS } from './profile.api'
import { useEvaluate, useEvaluation } from './use-profile'

/** AI review of the last saved resume. Advice only: not the match score, never shown to employers. */
export function EvaluationCard({ hasUnsavedChanges }: { hasUnsavedChanges: boolean }) {
  const query = useEvaluation()
  const evaluate = useEvaluate()
  const data = query.data
  const evaluation = data?.evaluation

  const run = () =>
    evaluate.mutate(undefined, {
      onError: (err) => toast.error('Could not evaluate', { description: getApiError(err).message }),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume review</CardTitle>
        <CardDescription>
          AI feedback on your last saved resume. Advice only: employers never see it and it does not change your match
          score. Your resume text is sent to OpenAI to write it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {evaluation && (
          <>
            <p className="text-3xl font-bold tabular-nums">
              {evaluation.overall}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </p>
            <ul className="flex flex-col gap-3">
              {EVAL_DIMENSIONS.map(([key, label]) => (
                <li key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">{evaluation.scores[key]}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={label}
                    aria-valuenow={evaluation.scores[key]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${evaluation.scores[key]}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <Notes title="Strengths" items={evaluation.strengths} />
            <Notes title="To improve" items={evaluation.weaknesses} />
            {evaluation.keywords.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium">Keywords to consider</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {evaluation.keywords.map((k) => (
                    <li key={k} className="rounded-full border px-2 py-0.5 text-xs">
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {!evaluation && !query.isPending && (
          <p className="text-sm text-muted-foreground">This version of your resume has not been reviewed yet.</p>
        )}
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={evaluate.isPending || hasUnsavedChanges || !!evaluation || query.isPending || data?.remainingToday === 0}
            onClick={run}
          >
            {evaluate.isPending ? 'Reviewing...' : 'Review my resume'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {hasUnsavedChanges
              ? 'Save your changes first: the review covers your last saved resume.'
              : evaluation
                ? 'Edit and save your resume to get a new review.'
                : data
                  ? `${data.remainingToday} review${data.remainingToday === 1 ? '' : 's'} left today. This can take up to a minute.`
                  : null}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function Notes({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  )
}
