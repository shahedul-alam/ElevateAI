import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABEL, type ApplicantResume } from '@/features/applications/applications.api'
import { useApplicants, useChangeApplicationStatus } from '@/features/applications/use-applications'
import { MatchBreakdown } from '@/features/matching/match-breakdown'
import type { ApplicationStatus } from '@/features/matching/matching.api'
import { DEGREE_LABELS, LEADERSHIP_LABELS, LEVEL_LABELS } from '@/features/profile/profile.schema'
import { getApiError } from '@/lib/api'
import { safeHref } from '@/lib/safe-href'

export default function EmployerApplicants() {
  return (
    <RequireRole role="employer" message="Applicants are for employer accounts.">
      <ApplicantsPage />
    </RequireRole>
  )
}

type Next = { status: Exclude<ApplicationStatus, 'applied'>; label: string }

// Mirrors the server's forward-only transitions; hired and rejected are final.
const NEXT: Record<ApplicationStatus, Next[]> = {
  applied: [
    { status: 'under_review', label: 'Start review' },
    { status: 'rejected', label: 'Reject' },
  ],
  under_review: [
    { status: 'hired', label: 'Hire' },
    { status: 'rejected', label: 'Reject' },
  ],
  rejected: [],
  hired: [],
}

function ApplicantsPage() {
  const { id = '' } = useParams()
  const applicants = useApplicants(id)
  const change = useChangeApplicationStatus()

  if (applicants.isPending) return null
  if (applicants.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          That job was not found.{' '}
          <Link to="/employer/jobs" className="underline">
            Back to your jobs
          </Link>
        </p>
      </main>
    )
  }

  const rows = applicants.data.pages.flatMap((p) => p.applicants)

  const move = (applicationId: string, status: Next['status']) =>
    change.mutate(
      { id: applicationId, status },
      {
        onSuccess: () => toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`),
        onError: (err) => toast.error('Could not update', { description: getApiError(err).message }),
      },
    )

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/employer/jobs" className="text-sm text-muted-foreground underline">
        Your jobs
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold tracking-tight">Applicants</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ranked by match score. Scores are fixed at the moment each candidate applied.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No applications yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((a, i) => (
            <li key={a.id}>
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                        {a.candidateName}
                      </p>
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
                      <p className="text-xs text-muted-foreground">
                        {STATUS_LABEL[a.status]} · applied {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums" aria-label={`Match score ${a.matchScore} percent`}>
                      {a.matchScore}%
                    </p>
                  </div>

                  {a.scoredAgainstOlderVersion && (
                    <p className="text-xs text-muted-foreground">
                      You edited this job after this candidate applied, so the score reflects its earlier
                      requirements.
                    </p>
                  )}

                  <details>
                    <summary className="cursor-pointer text-sm underline-offset-2 hover:underline">
                      Resume
                    </summary>
                    <div className="pt-4">
                      <ResumeView resume={a.resume} />
                    </div>
                  </details>

                  <details>
                    <summary className="cursor-pointer text-sm underline-offset-2 hover:underline">
                      Score breakdown
                    </summary>
                    <div className="pt-4">
                      <MatchBreakdown
                        {...a.breakdown}
                        showRadar={false}
                        showEligibility={false}
                        label={`${a.candidateName} match`}
                      />
                    </div>
                  </details>

                  {NEXT[a.status].length > 0 && (
                    <div className="flex gap-2">
                      {NEXT[a.status].map((n) => (
                        <Button
                          key={n.status}
                          size="sm"
                          variant={n.status === 'rejected' ? 'outline' : 'default'}
                          disabled={change.isPending}
                          onClick={() => move(a.id, n.status)}
                        >
                          {n.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {applicants.hasNextPage && (
        <Button
          variant="outline"
          className="mt-6"
          disabled={applicants.isFetchingNextPage}
          onClick={() => applicants.fetchNextPage()}
        >
          {applicants.isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </main>
  )
}

const joinParts = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

/** Read-only view of the resume snapshot a candidate applied with. */
function ResumeView({ resume }: { resume: ApplicantResume }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      {resume.summary && <p className="whitespace-pre-wrap">{resume.summary}</p>}

      {resume.skills.length > 0 && (
        <section>
          <h3 className="mb-1 font-medium">Skills</h3>
          <ul className="flex flex-wrap gap-2">
            {resume.skills.map((s) => (
              <li key={s.name} className="rounded-full border px-2.5 py-0.5 text-xs">
                {s.name} · {LEVEL_LABELS[s.level - 1]} · {s.years} yrs
              </li>
            ))}
          </ul>
        </section>
      )}

      {resume.roles.length > 0 && (
        <section>
          <h3 className="mb-1 font-medium">Experience</h3>
          <ul className="flex flex-col gap-3">
            {resume.roles.map((r, i) => (
              <li key={i}>
                <p className="font-medium">{joinParts(r.title, r.company)}</p>
                <p className="text-xs text-muted-foreground">
                  {joinParts(r.period, `${r.years} yrs`, r.domain)}
                </p>
                {r.description && <p className="mt-1 whitespace-pre-wrap">{r.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {resume.education.length > 0 && (
        <section>
          <h3 className="mb-1 font-medium">Education</h3>
          <ul className="flex flex-col gap-1">
            {resume.education.map((e, i) => (
              <li key={i}>
                {joinParts(DEGREE_LABELS[e.degreeLevel], e.field, e.institution, e.period)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-muted-foreground">
        {joinParts(
          resume.certifications.length > 0
            ? `Certifications: ${resume.certifications.join(', ')}`
            : undefined,
          resume.leadershipLevel > 0
            ? `Leadership: ${LEADERSHIP_LABELS[resume.leadershipLevel]}`
            : undefined,
        )}
      </p>
    </div>
  )
}
