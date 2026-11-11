import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAiConsent } from '@/features/auth/use-ai-consent'
import { getApiError } from '@/lib/api'
import { RESUME_MAX_BYTES, RESUME_TYPES } from './profile.api'
import type { ProfileContent } from './profile.schema'
import { useImportResume } from './use-profile'

/** Fills the form from an uploaded PDF or DOCX. Nothing is saved until the candidate presses Save. */
export function ImportCard({
  hasContent,
  onImported,
}: {
  hasContent: boolean
  onImported: (content: ProfileContent, termNames: Record<string, string>) => void
}) {
  const importResume = useImportResume()
  const { withAiConsent, retryOnConsentError, consentDialog } = useAiConsent()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<File | null>(null)

  const run = (file: File) =>
    importResume.mutate(file, {
      onSuccess: ({ content, termNames }) => {
        onImported(content, termNames)
        toast.success('Resume imported', {
          description:
            `Review everything before saving. Skill levels and years are estimates.` +
            (content.unmapped.length > 0 ? ` ${content.unmapped.length} item(s) were not in our catalog and are listed as other skills.` : ''),
        })
      },
      onError: (err) => {
        if (!retryOnConsentError(err, () => run(file))) {
          toast.error('Could not import', { description: getApiError(err).message })
        }
      },
    })

  const onPick = (file: File | undefined) => {
    if (input.current) input.current.value = '' // lets the same file be picked again
    if (!file) return
    if (!RESUME_TYPES.includes(file.type)) return void toast.error('Use a PDF or DOCX file')
    if (file.size > RESUME_MAX_BYTES) return void toast.error(`The file must be under ${RESUME_MAX_BYTES / 1024 / 1024} MB`)
    withAiConsent(() => (hasContent ? setPending(file) : run(file)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from a resume</CardTitle>
        <CardDescription>
          Upload a PDF or DOCX and AI fills the form below. The file is sent to OpenAI to read it; contact details are
          not imported. Nothing is saved until you press Save, and AI never affects your match score.{' '}
          <Link to="/privacy" className="underline">
            AI privacy notice
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id="resume-import"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={importResume.isPending}
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <Button asChild variant="outline" size="sm" aria-disabled={importResume.isPending}>
          <label htmlFor="resume-import" className="cursor-pointer">
            {importResume.isPending ? 'Reading your resume...' : 'Choose PDF or DOCX'}
          </label>
        </Button>
        <p className="text-xs text-muted-foreground">Up to 5 MB. This can take up to a minute.</p>
      </CardContent>
      {consentDialog}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Replace what is in the form?"
        description="The imported resume replaces your skills, roles, education and certifications in the form. Nothing is saved until you press Save."
        confirmLabel="Import"
        onConfirm={() => {
          if (pending) run(pending)
          setPending(null)
        }}
      />
    </Card>
  )
}
