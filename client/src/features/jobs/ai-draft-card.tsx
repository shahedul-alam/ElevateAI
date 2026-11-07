import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAiConsent } from '@/features/auth/use-ai-consent'
import { getApiError } from '@/lib/api'
import type { JobDraft } from './jobs.api'
import { useDraftJob } from './use-jobs'

const MIN = 20
const MAX = 12_000

/** Drafts the job form from a pasted description. Nothing is saved until the employer presses Save. */
export function AiDraftCard({
  hasContent,
  onDrafted,
}: {
  hasContent: boolean
  onDrafted: (result: JobDraft) => void
}) {
  const draft = useDraftJob()
  const { withAiConsent, retryOnConsentError, consentDialog } = useAiConsent()
  const [text, setText] = useState('')
  const [pending, setPending] = useState<JobDraft | null>(null)
  const ready = text.trim().length >= MIN && text.length <= MAX

  const apply = (result: JobDraft) => {
    onDrafted(result)
    toast.success('Draft added to the form', {
      description:
        'Review it before saving. Skills are scored, so check which are required.' +
        (result.unmappedSkills.length > 0 ? ` Not in our catalog: ${result.unmappedSkills.join(', ')}.` : ''),
    })
  }

  const run = () =>
    withAiConsent(() =>
      draft.mutate(text, {
        onSuccess: (result) => (hasContent ? setPending(result) : apply(result)),
        onError: (err) => {
          if (!retryOnConsentError(err, run)) {
            toast.error('Could not draft', { description: getApiError(err).message })
          }
        },
      }),
    )

  return (
    <Card>
      {consentDialog}
      <CardHeader>
        <CardTitle>Draft with AI</CardTitle>
        <CardDescription>
          Paste a rough job description and AI fills the title, overview, lists and suggested skills. The text is sent
          to OpenAI. Years, degree, certifications, pay and location are left for you to set, and nothing is saved until
          you press Save.{' '}
          <Link to="/privacy" className="underline">
            AI privacy notice
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Label htmlFor="ai-draft-text">Pasted posting text</Label>
        <textarea
          id="ai-draft-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX}
          rows={6}
          className="min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={!ready || draft.isPending} onClick={run}>
            {draft.isPending ? 'Drafting...' : 'Draft with AI'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {text.trim().length < MIN ? `At least ${MIN} characters.` : 'This can take up to a minute.'}
          </p>
        </div>
      </CardContent>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Replace what is in the form?"
        description="The draft replaces the title, description, lists and skills. Years, degree, certifications, pay and location stay as they are. Nothing is saved until you press Save."
        confirmLabel="Use draft"
        onConfirm={() => {
          if (pending) apply(pending)
          setPending(null)
        }}
      />
    </Card>
  )
}
