import { Link } from 'react-router'

import { RequireRole } from '@/components/require-role'
import { STATUS_LABEL, STATUS_STYLE } from '@/features/applications/applications.api'
import { JobCard } from '@/features/jobs/job-card'
import { useMyApplications } from '@/features/applications/use-applications'

export default function Applications() {
  return (
    <RequireRole role="candidate" message="Applications are for candidate accounts.">
      <ApplicationsPage />
    </RequireRole>
  )
}

function ApplicationsPage() {
  const applications = useMyApplications()

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Your applications</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Each score is the one calculated when you applied. Editing your resume later does not change it.
      </p>

      {applications.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : applications.isError ? (
        <p className="text-sm text-destructive">Could not load your applications.</p>
      ) : applications.data.applications.length === 0 ? (
        <p className="text-muted-foreground">
          You have not applied to any jobs yet.{' '}
          <Link to="/jobs" className="underline">
            Browse jobs
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.data.applications.map((a) => (
            <li key={a.id}>
              <JobCard
                job={{ ...a, id: a.jobId }}
                names={applications.data.termNames}
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
    </main>
  )
}
