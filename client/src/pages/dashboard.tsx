import { Link } from 'react-router'

import { PersonAvatar } from '@/components/person-avatar'
import { ProgressBar } from '@/components/progress-bar'
import { RequireRole } from '@/components/require-role'
import { Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABEL, STATUS_STYLE } from '@/features/applications/applications.api'
import { countMyByStatus } from '@/features/applications/my-application-filters'
import { useMyApplications } from '@/features/applications/use-applications'
import { useAuthStore } from '@/features/auth/auth.store'
import { JobCard } from '@/features/jobs/job-card'
import { useRecommended } from '@/features/matching/use-matching'
import { useUnreadCount } from '@/features/notifications/use-notifications'
import { completeness } from '@/features/profile/completeness'
import type { CurrentProfile } from '@/features/profile/profile.api'
import { useEvaluation, usePhotoDataUrl, usePhotoUrl, useProfile } from '@/features/profile/use-profile'
import { getApiError } from '@/lib/api'

export default function Dashboard() {
  return (
    <RequireRole role="candidate" message="The dashboard is for candidate accounts.">
      <DashboardPage />
    </RequireRole>
  )
}

const SHOWN = 3

function DashboardPage() {
  const name = useAuthStore((s) => s.user?.name ?? '')
  const profile = useProfile()
  const photoUrl = usePhotoUrl()
  const photo = usePhotoDataUrl(photoUrl.data)
  const current = profile.data ?? null

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center gap-4">
        <PersonAvatar name={name} src={photo.data} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">Welcome back, {name.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">Where you stand and what to do next.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/resume">Resume</Link>
          </Button>
          <Button asChild>
            <Link to="/jobs">Find jobs</Link>
          </Button>
        </div>
      </header>

      {profile.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : profile.isError ? (
        <p className="text-sm text-destructive">Could not load your resume.</p>
      ) : (
        <ChecklistSection profile={current} hasPhoto={!!photoUrl.data} />
      )}

      <Stats />
      {current && <ResumeScore />}
      <RecentApplications />
      <Recommended hasResume={!!current} loading={profile.isPending} />
    </main>
  )
}

/** Only mounts the review lookup when there is a saved resume (the server answers 409 without one). */
function ChecklistSection({ profile, hasPhoto }: { profile: CurrentProfile | null; hasPhoto: boolean }) {
  return profile ? (
    <ChecklistWithReview profile={profile} hasPhoto={hasPhoto} />
  ) : (
    <Checklist result={completeness(null, hasPhoto, false)} />
  )
}

function ChecklistWithReview({ profile, hasPhoto }: { profile: CurrentProfile; hasPhoto: boolean }) {
  const evaluation = useEvaluation()
  return <Checklist result={completeness(profile, hasPhoto, !!evaluation.data?.evaluation)} />
}

function Checklist({ result }: { result: ReturnType<typeof completeness> }) {
  if (result.percent === 100) return null
  const todo = result.items.filter((i) => !i.done)
  return (
    <section aria-labelledby="checklist-heading">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="checklist-heading" className="font-semibold">
              Complete your profile
            </h2>
            <span className="text-sm tabular-nums text-muted-foreground">{result.percent}%</span>
          </div>
          <ProgressBar value={result.percent} label="Profile completeness" />
          <ul className="flex flex-col gap-1 text-sm">
            {todo.map((i) => (
              <li key={i.key}>
                <Link to="/resume" className="underline-offset-2 hover:underline">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

const IN_PROGRESS = ['applied', 'under_review', 'technical_interview', 'culture_fit']

function Stats() {
  const applications = useMyApplications()
  const unread = useUnreadCount()
  const counts = countMyByStatus(applications.data?.applications ?? [])
  const inProgress = IN_PROGRESS.reduce((n, s) => n + (counts[s] ?? 0), 0)

  return (
    <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Applications" value={counts.all ?? 0} to="/applications" />
      <Stat label="In progress" value={inProgress} to="/applications" />
      <Stat label="Offers" value={counts.offer ?? 0} to="/applications?status=offer" />
      <Stat label="Hired" value={counts.hired ?? 0} to="/applications?status=hired" />
      <Stat label="Unread notifications" value={unread.data ?? 0} />
    </section>
  )
}

function ResumeScore() {
  const evaluation = useEvaluation()
  if (evaluation.isPending) return <p className="text-sm text-muted-foreground">Loading...</p>
  const result = evaluation.data?.evaluation
  return (
    <section aria-labelledby="score-heading">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="score-heading" className="font-semibold">
              Resume review
            </h2>
            {result ? (
              <p className="text-3xl font-bold tabular-nums">
                {result.overall} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Your saved resume has not been reviewed yet.</p>
            )}
          </div>
          <Button variant="outline" asChild>
            <Link to="/resume">{result ? 'See the review' : 'Review my resume'}</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

function RecentApplications() {
  const applications = useMyApplications()
  const recent = [...(applications.data?.applications ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, SHOWN)

  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="recent-heading" className="font-semibold">
          Recent applications
        </h2>
        {recent.length > 0 && (
          <Link to="/applications" className="text-sm underline-offset-2 hover:underline">
            View all
          </Link>
        )}
      </div>
      {applications.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : applications.isError ? (
        <p className="text-sm text-destructive">Could not load your applications.</p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have not applied to any jobs yet.{' '}
          <Link to="/jobs" className="underline">
            Browse jobs
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {recent.map((a) => (
            <li key={a.id}>
              <JobCard
                job={{ ...a, id: a.jobId }}
                names={applications.data!.termNames}
                score={a.matchScore}
                linkable={a.jobStatus === 'active'}
                badge={
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                }
                footer={`Applied ${new Date(a.createdAt).toLocaleDateString()}${a.jobStatus === 'closed' ? ' · job closed' : ''}`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Recommended({ hasResume, loading }: { hasResume: boolean; loading: boolean }) {
  // The server answers 409 without a resume, so only ask once we know there is one.
  const recommended = useRecommended(hasResume)
  const noResume = !loading && !hasResume

  return (
    <section aria-labelledby="recommended-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="recommended-heading" className="font-semibold">
          Recommended for you
        </h2>
        <Link to="/jobs" className="text-sm underline-offset-2 hover:underline">
          Browse all jobs
        </Link>
      </div>
      {noResume || (recommended.isError && getApiError(recommended.error).status === 409) ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/resume" className="underline">
            Build your resume
          </Link>{' '}
          to see jobs ranked by how well you match.
        </p>
      ) : loading || recommended.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : recommended.isError ? (
        <p className="text-sm text-destructive">Could not load recommendations.</p>
      ) : recommended.data.jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No new matches right now. Check back after new jobs are posted.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {recommended.data.jobs.slice(0, SHOWN).map((job) => (
            <li key={job.id}>
              <JobCard job={job} names={recommended.data.termNames} score={job.score} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
