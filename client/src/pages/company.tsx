import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/auth.store'
import { CompanyProfileView } from '@/features/company/company-profile-view'
import { useCompany, useMyCompany, useSetCompanyVerified } from '@/features/company/use-company'
import { getApiError } from '@/lib/api'

/** The public company page. Owners get an edit link and admins get the verification toggle. */
export default function CompanyPage() {
  const { id = '' } = useParams()
  const company = useCompany(id)
  const user = useAuthStore((s) => s.user)
  const mine = useMyCompany(user?.role === 'employer')
  const setVerified = useSetCompanyVerified()

  if (company.isPending) return null
  if (company.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          This company page is not available. <Link to="/companies" className="underline">Browse companies</Link>
        </p>
      </main>
    )
  }

  const { company: c, jobs, termNames } = company.data
  // Only the employer who owns this company: never infer it from cached data alone.
  const isOwner = user?.role === 'employer' && mine.data?.id === c.id

  const toggleVerified = () =>
    setVerified.mutate(
      { id: c.id, verified: !c.verified },
      {
        onSuccess: () => toast.success(c.verified ? 'Verification removed' : 'Company verified'),
        onError: (err) => toast.error('Could not update', { description: getApiError(err).message }),
      },
    )

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/companies" className="mb-4 inline-block text-sm text-muted-foreground underline">
        All companies
      </Link>
      <CompanyProfileView
        company={c}
        jobs={jobs}
        termNames={termNames}
        actions={
          <>
            {isOwner && (
              <>
                <Button asChild variant="outline">
                  <Link to="/employer/company">Edit profile</Link>
                </Button>
                <Button asChild>
                  <Link to="/employer/jobs/new">Post new role</Link>
                </Button>
              </>
            )}
            {user?.role === 'admin' && (
              <Button variant="outline" disabled={setVerified.isPending} onClick={toggleVerified}>
                {c.verified ? 'Remove verification' : 'Mark as verified'}
              </Button>
            )}
          </>
        }
      />
    </main>
  )
}
