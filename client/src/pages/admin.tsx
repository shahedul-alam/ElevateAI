import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { RequireRole } from '@/components/require-role'
import { Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  JOB_FILTERS,
  USER_FILTERS,
  type AdminJob,
  type AdminUser,
  type JobFilter,
  type UserFilter,
} from '@/features/admin/admin.api'
import { SuspendDialog } from '@/features/admin/suspend-dialog'
import {
  useAdminJobs,
  useAdminUsers,
  useOverview,
  useRestoreJob,
  useRestoreUser,
  useSuspendJob,
  useSuspendUser,
} from '@/features/admin/use-admin'
import { useCompanies, useSetCompanyVerified } from '@/features/company/use-company'
import { oneOf } from '@/features/jobs/employer-job-filters'
import { useAuthStore } from '@/features/auth/auth.store'
import { getApiError } from '@/lib/api'

const TABS = ['overview', 'users', 'jobs', 'companies'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { overview: 'Overview', users: 'Users', jobs: 'Jobs', companies: 'Companies' }

export default function Admin() {
  return (
    <RequireRole role="admin" message="The admin dashboard is for administrators.">
      <AdminPage />
    </RequireRole>
  )
}

function AdminPage() {
  const [params, setParams] = useSearchParams()
  const tab = oneOf(TABS, params.get('tab'), 'overview')

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Admin</h1>

      <div role="tablist" aria-label="Admin sections" className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`admin-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="admin-panel"
            // Switching tabs drops the other tab's search and filter.
            onClick={() => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'jobs' && <JobsTab />}
        {tab === 'companies' && <CompaniesTab />}
      </div>
    </main>
  )
}

function OverviewTab() {
  const overview = useOverview()
  if (overview.isPending) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (overview.isError) return <p className="text-sm text-destructive">Could not load the overview.</p>
  const { users, jobs, suspendedUsers, suspendedJobs, unverifiedCompanies } = overview.data

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Candidates" value={users.candidate ?? 0} to="/admin?tab=users&f=candidate" />
      <Stat label="Employers" value={users.employer ?? 0} to="/admin?tab=users&f=employer" />
      <Stat label="Suspended users" value={suspendedUsers} to="/admin?tab=users&f=suspended" />
      <Stat label="Active jobs" value={jobs.active ?? 0} to="/admin?tab=jobs&f=active" />
      <Stat label="Suspended jobs" value={suspendedJobs} to="/admin?tab=jobs&f=suspended" />
      <Stat label="Unverified companies" value={unverifiedCompanies} to="/admin?tab=companies" />
    </div>
  )
}

/** Search box plus one row of filter buttons, mirrored to `?q=&f=` (defaults left out). */
function useListFilters<F extends string>(options: readonly F[]) {
  const [params, setParams] = useSearchParams()
  // Typing stays in local state (router updates are transitions); the URL mirrors it.
  const [search, setSearch] = useState(params.get('q') ?? '')
  const filter = oneOf(options, params.get('f'), options[0] as F)

  const update = (next: { q?: string; f?: F }) => {
    // Merge against the live URL so back-to-back changes cannot overwrite each other.
    const live = new URLSearchParams(window.location.search)
    const merged = { q: live.get('q') ?? '', f: live.get('f') ?? options[0], ...next }
    const query: Record<string, string> = {}
    const tab = live.get('tab')
    if (tab) query.tab = tab
    if (merged.q) query.q = merged.q
    if (merged.f !== options[0]) query.f = merged.f
    setParams(query, { replace: true })
  }

  return {
    filters: { q: search.trim(), filter },
    search,
    onSearch: (q: string) => {
      setSearch(q)
      update({ q })
    },
    onFilter: (f: F) => update({ f }),
  }
}

function ListControls<F extends string>({
  label,
  options,
  state,
}: {
  label: string
  options: readonly F[]
  state: ReturnType<typeof useListFilters<F>>
}) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <Input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={`Search ${label}`}
        value={state.search}
        onChange={(e) => state.onSearch(e.target.value)}
      />
      <div role="group" aria-label={`Filter ${label}`} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o}
            type="button"
            size="sm"
            variant={state.filters.filter === o ? 'default' : 'outline'}
            aria-pressed={state.filters.filter === o}
            onClick={() => state.onFilter(o)}
          >
            {o === 'all' ? 'All' : o.charAt(0).toUpperCase() + o.slice(1)}
          </Button>
        ))}
      </div>
    </div>
  )
}

function LoadMore({ show, loading, onClick }: { show: boolean; loading: boolean; onClick: () => void }) {
  if (!show) return null
  return (
    <div className="mt-4 text-center">
      <Button variant="outline" disabled={loading} onClick={onClick}>
        {loading ? 'Loading...' : 'Load more'}
      </Button>
    </div>
  )
}

function SuspendedNote({ reason }: { reason: string | null }) {
  return (
    <p role="note" className="mt-1 text-xs font-medium text-destructive">
      Suspended{reason ? `: ${reason}` : ''}
    </p>
  )
}

type Target = { id: string; name: string }

function UsersTab() {
  const state = useListFilters<UserFilter>(USER_FILTERS)
  const users = useAdminUsers(state.filters)
  const me = useAuthStore((s) => s.user?.id)
  const suspend = useSuspendUser()
  const restore = useRestoreUser()
  const [suspending, setSuspending] = useState<Target | null>(null)
  const [restoring, setRestoring] = useState<Target | null>(null)
  const rows = users.data?.pages.flatMap((p) => p.users) ?? []

  const fail = (what: string) => (err: unknown) =>
    toast.error(`Could not ${what}`, { description: getApiError(err).message })

  return (
    <>
      <ListControls label="users" options={USER_FILTERS} state={state} />
      {users.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : users.isError ? (
        <p className="text-sm text-destructive">Could not load users.</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No users match.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((u: AdminUser) => (
            <li key={u.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email} · {u.role} · joined {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                    {u.suspendedAt && <SuspendedNote reason={u.suspendedReason} />}
                  </div>
                  {u.suspendedAt ? (
                    <Button variant="outline" size="sm" onClick={() => setRestoring({ id: u.id, name: u.name })}>
                      Restore
                    </Button>
                  ) : (
                    u.role !== 'admin' &&
                    u.id !== me && (
                      <Button variant="outline" size="sm" onClick={() => setSuspending({ id: u.id, name: u.name })}>
                        Suspend
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <LoadMore show={!!users.hasNextPage} loading={users.isFetchingNextPage} onClick={() => users.fetchNextPage()} />

      <SuspendDialog
        key={suspending?.id ?? 'none'}
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={suspending ? `Suspend ${suspending.name}?` : 'Suspend user'}
        description="They are signed out everywhere and cannot sign in. Their jobs and company page are hidden. Nothing is deleted, and you can restore the account later."
        pending={suspend.isPending}
        onConfirm={(reason) =>
          suspending &&
          suspend.mutate(
            { id: suspending.id, reason },
            {
              onSuccess: () => toast.success('User suspended'),
              onError: fail('suspend user'),
              onSettled: () => setSuspending(null),
            },
          )
        }
      />
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={restoring ? `Restore ${restoring.name}?` : 'Restore user'}
        description="They can sign in again, and their jobs and company page become visible."
        confirmLabel="Restore"
        pendingLabel="Restoring..."
        pending={restore.isPending}
        onConfirm={() =>
          restoring &&
          restore.mutate(restoring.id, {
            onSuccess: () => toast.success('User restored'),
            onError: fail('restore user'),
            onSettled: () => setRestoring(null),
          })
        }
      />
    </>
  )
}

function JobsTab() {
  const state = useListFilters<JobFilter>(JOB_FILTERS)
  const jobs = useAdminJobs(state.filters)
  const suspend = useSuspendJob()
  const restore = useRestoreJob()
  const [suspending, setSuspending] = useState<Target | null>(null)
  const [restoring, setRestoring] = useState<Target | null>(null)
  const rows = jobs.data?.pages.flatMap((p) => p.jobs) ?? []

  const fail = (what: string) => (err: unknown) =>
    toast.error(`Could not ${what}`, { description: getApiError(err).message })

  return (
    <>
      <ListControls label="jobs by title" options={JOB_FILTERS} state={state} />
      {jobs.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : jobs.isError ? (
        <p className="text-sm text-destructive">Could not load jobs.</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No jobs match.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((j: AdminJob) => (
            <li key={j.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    {j.status === 'active' && !j.suspendedAt && !j.employer.suspended ? (
                      <Link to={`/jobs/${j.id}`} className="block truncate font-medium underline-offset-2 hover:underline">
                        {j.title || 'Untitled job'}
                      </Link>
                    ) : (
                      <p className="truncate font-medium">{j.title || 'Untitled job'}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {j.status} · {j.company?.name ?? j.employer.name} ({j.employer.email})
                      {j.employer.suspended ? ' · employer suspended' : ''}
                    </p>
                    {j.suspendedAt && <SuspendedNote reason={j.suspendedReason} />}
                  </div>
                  {j.suspendedAt ? (
                    <Button variant="outline" size="sm" onClick={() => setRestoring({ id: j.id, name: j.title })}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setSuspending({ id: j.id, name: j.title })}>
                      Suspend
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <LoadMore show={!!jobs.hasNextPage} loading={jobs.isFetchingNextPage} onClick={() => jobs.fetchNextPage()} />

      <SuspendDialog
        key={suspending?.id ?? 'none'}
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={suspending ? `Suspend "${suspending.name}"?` : 'Suspend job'}
        description="The job is hidden from candidates and the employer cannot edit or republish it. The employer is notified. Applications are kept."
        pending={suspend.isPending}
        onConfirm={(reason) =>
          suspending &&
          suspend.mutate(
            { id: suspending.id, reason },
            {
              onSuccess: () => toast.success('Job suspended'),
              onError: fail('suspend job'),
              onSettled: () => setSuspending(null),
            },
          )
        }
      />
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={restoring ? `Restore "${restoring.name}"?` : 'Restore job'}
        description="The job goes back to the status it had. The employer is notified."
        confirmLabel="Restore"
        pendingLabel="Restoring..."
        pending={restore.isPending}
        onConfirm={() =>
          restoring &&
          restore.mutate(restoring.id, {
            onSuccess: () => toast.success('Job restored'),
            onError: fail('restore job'),
            onSettled: () => setRestoring(null),
          })
        }
      />
    </>
  )
}

function CompaniesTab() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const companies = useCompanies({ q: search.trim(), domainId: '' })
  const verify = useSetCompanyVerified()
  const rows = companies.data?.pages.flatMap((p) => p.companies) ?? []

  return (
    <>
      <div className="mb-4">
        <Input
          type="search"
          aria-label="Search companies"
          placeholder="Search companies"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setParams(e.target.value ? { tab: 'companies', q: e.target.value } : { tab: 'companies' }, {
              replace: true,
            })
          }}
        />
      </div>
      {companies.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : companies.isError ? (
        <p className="text-sm text-destructive">Could not load companies.</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No companies match.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/companies/${c.id}`} className="block truncate font-medium underline-offset-2 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.verified ? 'Verified' : 'Not verified'} · {c.openPositions} open{' '}
                      {c.openPositions === 1 ? 'position' : 'positions'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={verify.isPending}
                    onClick={() =>
                      verify.mutate(
                        { id: c.id, verified: !c.verified },
                        {
                          onSuccess: () => toast.success(c.verified ? 'Verification removed' : 'Company verified'),
                          onError: (err) =>
                            toast.error('Could not update', { description: getApiError(err).message }),
                        },
                      )
                    }
                  >
                    {c.verified ? 'Remove verification' : 'Mark as verified'}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <LoadMore
        show={!!companies.hasNextPage}
        loading={companies.isFetchingNextPage}
        onClick={() => companies.fetchNextPage()}
      />
    </>
  )
}
