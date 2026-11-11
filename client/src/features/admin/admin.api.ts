import { api } from '@/lib/api'

export type AdminOverview = {
  users: Record<string, number>
  suspendedUsers: number
  jobs: Record<string, number>
  suspendedJobs: number
  unverifiedCompanies: number
}

export type AdminUser = {
  id: string
  name: string
  email: string
  role: 'candidate' | 'employer' | 'admin'
  emailVerified: boolean
  suspendedAt: string | null
  suspendedReason: string | null
  createdAt: string
}

export type AdminJob = {
  id: string
  title: string
  status: 'draft' | 'active' | 'closed'
  publishedAt: string | null
  suspendedAt: string | null
  suspendedReason: string | null
  employer: { id: string; name: string; email: string; suspended: boolean }
  company: { id: string; name: string } | null
}

/** One filter per list: a role / status, or `suspended`. `all` sends nothing. */
export const USER_FILTERS = ['all', 'candidate', 'employer', 'admin', 'suspended'] as const
export const JOB_FILTERS = ['all', 'draft', 'active', 'closed', 'suspended'] as const
export type UserFilter = (typeof USER_FILTERS)[number]
export type JobFilter = (typeof JOB_FILTERS)[number]

export type AdminListFilters<F extends string> = { q: string; filter: F }

const params = (q: string, key: 'role' | 'status', filter: string, cursor?: string) => ({
  ...(q && { q }),
  ...(filter === 'suspended' ? { suspended: true } : filter !== 'all' && { [key]: filter }),
  ...(cursor && { cursor }),
})

export async function fetchOverview() {
  const { data } = await api.get<AdminOverview>('/admin/overview')
  return data
}

export async function fetchAdminUsers(f: AdminListFilters<UserFilter>, cursor?: string) {
  const { data } = await api.get<{ users: AdminUser[]; nextCursor: string | null }>('/admin/users', {
    params: params(f.q, 'role', f.filter, cursor),
  })
  return data
}

export async function fetchAdminJobs(f: AdminListFilters<JobFilter>, cursor?: string) {
  const { data } = await api.get<{ jobs: AdminJob[]; nextCursor: string | null }>('/admin/jobs', {
    params: params(f.q, 'status', f.filter, cursor),
  })
  return data
}

export async function suspendUserRequest(input: { id: string; reason: string }) {
  const { data } = await api.post<{ user: AdminUser }>(`/admin/users/${input.id}/suspension`, { reason: input.reason })
  return data.user
}

export async function restoreUserRequest(id: string) {
  const { data } = await api.delete<{ user: AdminUser }>(`/admin/users/${id}/suspension`)
  return data.user
}

export async function suspendJobRequest(input: { id: string; reason: string }) {
  const { data } = await api.post<{ job: AdminJob }>(`/admin/jobs/${input.id}/suspension`, { reason: input.reason })
  return data.job
}

export async function restoreJobRequest(id: string) {
  const { data } = await api.delete<{ job: AdminJob }>(`/admin/jobs/${id}/suspension`)
  return data.job
}

export const AUDIT_FILTERS = [
  'all',
  'user.suspend',
  'user.restore',
  'user.delete',
  'job.suspend',
  'job.restore',
  'company.verify',
  'company.unverify',
] as const
export type AuditFilter = (typeof AUDIT_FILTERS)[number]

export type AuditEntry = {
  id: string
  createdAt: string
  actorId: string
  actorEmail: string
  action: Exclude<AuditFilter, 'all'>
  targetType: string
  targetId: string
  targetLabel: string
  reason: string | null
}

export async function fetchAudit(f: AdminListFilters<AuditFilter>, cursor?: string) {
  const { data } = await api.get<{ entries: AuditEntry[]; nextCursor: string | null }>('/admin/audit', {
    params: {
      ...(f.q && { q: f.q }),
      ...(f.filter !== 'all' && { action: f.filter }),
      ...(cursor && { cursor }),
    },
  })
  return data
}

export async function deleteUserRequest(input: { id: string; confirmEmail: string }) {
  await api.delete(`/admin/users/${input.id}`, { data: { confirmEmail: input.confirmEmail } })
}
