import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { NativeSelect } from '@/components/native-select'
import { PersonAvatar } from '@/components/person-avatar'
import { Card, CardContent } from '@/components/ui/card'
import { MatchBreakdown } from '@/features/matching/match-breakdown'
import type { ApplicationStatus } from '@/features/matching/matching.api'
import { DEGREE_LABELS, LEADERSHIP_LABELS, LEVEL_LABELS } from '@/features/profile/profile.schema'
import { getApiError } from '@/lib/api'
import { safeHref } from '@/lib/safe-href'
import { ApplicantDetails } from './applicant-details'
import {
  STATUS_LABEL,
  STATUS_STYLE,
  nextStatuses,
  type Applicant,
  type ApplicantResume,
} from './applications.api'
import { Button } from '@/components/ui/button'
import { RatingStars } from './rating-stars'
import { useChangeApplicationStatus, useSetRating } from './use-applications'

const joinParts = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

/** One applicant, used by both the per-job list and the company-wide hiring page. */
export function ApplicantCard({
  applicant: a,
  rank,
  showJob = false,
}: {
  applicant: Applicant
  rank?: number
  showJob?: boolean
}) {
  const change = useChangeApplicationStatus()
  const setRating = useSetRating()
  const [confirming, setConfirming] = useState<ApplicationStatus | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const next = nextStatuses(a.status)

  const move = (status: ApplicationStatus) =>
    change.mutate(
      { id: a.id, status },
      {
        onSuccess: () => toast.success(`Moved to ${STATUS_LABEL[status].toLowerCase()}`),
        onError: (err) => toast.error('Could not update', { description: getApiError(err).message }),
        onSettled: () => setConfirming(null),
      },
    )

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PersonAvatar name={a.candidateName} src={a.photoUrl} className="size-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium">
              <span>
                {rank !== undefined && <span className="mr-2 text-muted-foreground">#{rank}</span>}
                {a.candidateName}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-normal ${STATUS_STYLE[a.status]}`}>
                {STATUS_LABEL[a.status]}
              </span>
            </p>
            {showJob && (
              <p className="text-xs">
                <Link to={`/employer/jobs/${a.jobId}/edit?tab=preview`} className="underline">
                  {a.jobTitle}
                </Link>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {[a.candidateEmail, a.headline, `${a.totalYears} yrs experience`].filter(Boolean).join(' · ')}
            </p>
            {(a.contact.phone || a.contact.city || a.contact.country) && (
              <p className="text-xs text-muted-foreground">
                {joinParts(
                  a.contact.phone ? `Phone: ${a.contact.phone}` : undefined,
                  [a.contact.city, a.contact.country].filter(Boolean).join(', ') || undefined,
                )}
              </p>
            )}
            {a.contact.links.length > 0 && (
              <ul className="flex flex-wrap gap-x-3 text-xs">
                {a.contact.links.map((l) => {
                  const href = safeHref(l.url)
                  return href ? (
                    <li key={l.label}>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                        {l.label}
                      </a>
                    </li>
                  ) : null
                })}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">applied {new Date(a.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums" aria-label={`Match score ${a.matchScore} percent`}>
              {a.matchScore}%
            </p>
            <p className="text-xs text-muted-foreground">Match</p>
          </div>
        </div>

        {a.scoredAgainstOlderVersion && (
          <p className="text-xs text-muted-foreground">
            You edited this job after this candidate applied, so the score reflects its earlier requirements.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">AI summary</p>
          {a.summary ? (
            <p className="text-sm leading-relaxed">{a.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not ready yet. It appears here once it has been written.</p>
          )}
          <p className="text-xs text-muted-foreground">Describes the resume only. It is not a recommendation.</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Your rating</span>
            <RatingStars
              label={`Your rating for ${a.candidateName}`}
              value={a.rating}
              disabled={setRating.isPending}
              onChange={(rating) =>
                setRating.mutate(
                  { id: a.id, rating },
                  { onError: (err) => toast.error('Could not save rating', { description: getApiError(err).message }) },
                )
              }
            />
          </div>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setDetailsOpen(true)}>
            Notes ({a.noteCount}) and history
          </Button>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium underline-offset-2 hover:underline">Resume</summary>
          <div className="pt-4">
            <ResumeView resume={a.resume} />
          </div>
        </details>

        <details>
          <summary className="cursor-pointer text-sm font-medium underline-offset-2 hover:underline">
            Score breakdown
          </summary>
          <div className="pt-4">
            <MatchBreakdown {...a.breakdown} showRadar={false} showEligibility={false} label={`${a.candidateName} match`} />
          </div>
        </details>

        {next.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <label htmlFor={`stage-${a.id}`} className="text-sm text-muted-foreground">
              Move to stage
            </label>
            <NativeSelect
              id={`stage-${a.id}`}
              className="w-56"
              disabled={change.isPending}
              value={a.status}
              // Hiring and rejecting are final, so they ask first; other stages apply straight away.
              onChange={(e) => {
                const to = e.target.value as ApplicationStatus
                if (to === 'hired' || to === 'rejected') setConfirming(to)
                else move(to)
              }}
            >
              <option value={a.status} disabled>
                {STATUS_LABEL[a.status]} (current)
              </option>
              {next.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </CardContent>

      <ApplicantDetails applicant={a} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? `${confirming === 'hired' ? 'Hire' : 'Reject'} ${a.candidateName}?` : ''}
        description={`This is final. A ${confirming === 'hired' ? 'hired' : 'rejected'} application cannot be moved again.`}
        confirmLabel={confirming === 'hired' ? 'Hire' : 'Reject'}
        pendingLabel="Saving..."
        pending={change.isPending}
        destructive={confirming === 'rejected'}
        onConfirm={() => confirming && move(confirming)}
      />
    </Card>
  )
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
    {children}
  </section>
)

const chip = 'rounded-full border bg-background px-3 py-1 text-xs'

/** Read-only view of the resume snapshot a candidate applied with. */
function ResumeView({ resume }: { resume: ApplicantResume }) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border bg-muted/30 p-4 text-sm">
      {resume.summary && (
        <Section title="Summary">
          <p className="leading-relaxed whitespace-pre-wrap">{resume.summary}</p>
        </Section>
      )}

      {resume.skills.length > 0 && (
        <Section title="Skills">
          <ul className="flex flex-wrap gap-2">
            {resume.skills.map((s) => (
              <li key={s.name} className={chip}>
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {LEVEL_LABELS[s.level - 1]} · {s.years} yrs
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.roles.length > 0 && (
        <Section title="Experience">
          <ul className="flex flex-col gap-4 border-l-2 pl-4">
            {resume.roles.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {joinParts(r.company, r.period, `${r.years} yrs`, r.domain)}
                </p>
                {r.description && <p className="mt-1 leading-relaxed whitespace-pre-wrap">{r.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.education.length > 0 && (
        <Section title="Education">
          <ul className="flex flex-col gap-3 border-l-2 pl-4">
            {resume.education.map((e, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <p className="font-medium">{joinParts(DEGREE_LABELS[e.degreeLevel], e.field)}</p>
                <p className="text-xs text-muted-foreground">{joinParts(e.institution, e.period)}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.certifications.length > 0 && (
        <Section title="Certifications">
          <ul className="flex flex-wrap gap-2">
            {resume.certifications.map((c) => (
              <li key={c} className={chip}>
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.leadershipLevel > 0 && (
        <Section title="Leadership">
          <p>{LEADERSHIP_LABELS[resume.leadershipLevel]}</p>
        </Section>
      )}
    </div>
  )
}
