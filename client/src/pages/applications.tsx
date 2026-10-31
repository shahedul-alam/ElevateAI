import { Link } from 'react-router'

import { RequireRole } from '@/components/require-role'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABEL } from '@/features/applications/applications.api'
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
      ) : applications.data.length === 0 ? (
        <p className="text-muted-foreground">
          You have not applied to any jobs yet.{' '}
          <Link to="/jobs" className="underline">
            Browse jobs
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.data.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    {a.jobStatus === 'active' ? (
                      <Link to={`/jobs/${a.jobId}`} className="truncate font-medium underline-offset-2 hover:underline">
                        {a.title}
                      </Link>
                    ) : (
                      <p className="truncate font-medium">{a.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABEL[a.status]} · applied {new Date(a.createdAt).toLocaleDateString()}
                      {a.jobStatus === 'closed' && ' · job closed'}
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums" aria-label={`Match score ${a.matchScore} percent`}>
                    {a.matchScore}%
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
