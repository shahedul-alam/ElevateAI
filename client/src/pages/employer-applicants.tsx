import { Link, useParams } from 'react-router'

import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { ApplicantCard } from '@/features/applications/applicant-card'
import { useApplicants } from '@/features/applications/use-applications'

export default function EmployerApplicants() {
  return (
    <RequireRole role="employer" message="Applicants are for employer accounts.">
      <ApplicantsPage />
    </RequireRole>
  )
}

function ApplicantsPage() {
  const { id = '' } = useParams()
  const applicants = useApplicants(id)

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/employer/jobs" className="text-sm text-muted-foreground underline">
        Your jobs
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold tracking-tight">Applicants</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ranked by match score. Scores are fixed at the moment each candidate applied.{' '}
        <Link to={`/employer/hiring?job=${id}`} className="underline">
          Open in Hiring
        </Link>
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No applications yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((a, i) => (
            <li key={a.id}>
              <ApplicantCard applicant={a} rank={i + 1} />
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
