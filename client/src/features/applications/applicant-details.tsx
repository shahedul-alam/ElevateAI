import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getApiError } from '@/lib/api'
import type { Applicant } from './applications.api'
import { RatingStars } from './rating-stars'
import { StatusHistory } from './status-history'
import {
  useAddNote,
  useApplicationActivity,
  useDeleteNote,
  useSetRating,
} from './use-applications'

const textareaClass =
  'min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const when = (iso: string) => new Date(iso).toLocaleString()

/** Private to the employer: rating, notes and the status history of one application. */
export function ApplicantDetails({
  applicant,
  open,
  onOpenChange,
}: {
  applicant: Applicant
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const activity = useApplicationActivity(applicant.id, open)
  const addNote = useAddNote()
  const deleteNote = useDeleteNote()
  const setRating = useSetRating()
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    addNote.mutate(
      { id: applicant.id, body: draft },
      {
        onSuccess: () => setDraft(''),
        onError: (err) => toast.error('Could not save note', { description: getApiError(err).message }),
      },
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{applicant.candidateName}</SheetTitle>
          <SheetDescription>
            {applicant.jobTitle} · private to you, the candidate never sees this.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section>
            <h3 className="mb-1 text-sm font-medium">Your rating</h3>
            <RatingStars
              label="Your rating"
              value={applicant.rating}
              disabled={setRating.isPending}
              onChange={(rating) =>
                setRating.mutate(
                  { id: applicant.id, rating },
                  { onError: (err) => toast.error('Could not save rating', { description: getApiError(err).message }) },
                )
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">Your own opinion. It does not change the match score.</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Notes</h3>
            <form onSubmit={submit} className="flex flex-col gap-2">
              <textarea
                className={textareaClass}
                aria-label="New note"
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" size="sm" className="self-start" disabled={addNote.isPending || !draft.trim()}>
                {addNote.isPending ? 'Saving...' : 'Add note'}
              </Button>
            </form>
            {activity.isPending ? (
              <p className="mt-3 text-xs text-muted-foreground">Loading...</p>
            ) : activity.isError ? (
              <p className="mt-3 text-xs text-destructive">Could not load notes.</p>
            ) : activity.data.notes.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {activity.data.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border p-3">
                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{when(n.createdAt)}</span>
                      <Button variant="ghost" size="xs" onClick={() => setDeleting(n.id)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Status history</h3>
            {activity.data ? (
              <StatusHistory history={activity.data.history} />
            ) : (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </section>
        </div>
      </SheetContent>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        pending={deleteNote.isPending}
        destructive
        onConfirm={() =>
          deleting &&
          deleteNote.mutate(
            { id: applicant.id, noteId: deleting },
            {
              onError: (err) => toast.error('Could not delete note', { description: getApiError(err).message }),
              onSettled: () => setDeleting(null),
            },
          )
        }
      />
    </Sheet>
  )
}
