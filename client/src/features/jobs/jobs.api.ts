import { api } from '@/lib/api'
import type { WorkMode } from '@/features/profile/profile.schema'
import type { JobContent } from './jobs.schema'

export type JobStatus = 'draft' | 'active' | 'closed'
export type JobAction = 'publish' | 'unpublish' | 'close'

export type JobDetail = {
  id: string
  status: JobStatus
  publishedAt: string | null
  versionId: string
  content: JobContent
  termNames: Record<string, string>
  employerName?: string
}

export type EmployerJobSummary = {
  id: string
  status: JobStatus
  title: string
  publishedAt: string | null
  updatedAt: string
}

export type JobCard = {
  id: string
  employerName: string
  title: string
  location?: string
  workMode?: WorkMode
  salaryMin?: number
  salaryMax?: number
  domainId?: string
  skillIds: string[]
  publishedAt: string
}

export type JobListFilters = { q: string; workMode: string; domainId: string }

export async function fetchJobs(filters: JobListFilters, cursor?: string) {
  const params = {
    ...(filters.q && { q: filters.q }),
    ...(filters.workMode && { workMode: filters.workMode }),
    ...(filters.domainId && { domainId: filters.domainId }),
    ...(cursor && { cursor }),
  }
  const { data } = await api.get<{
    jobs: JobCard[]
    termNames: Record<string, string>
    nextCursor: string | null
  }>('/jobs', { params })
  return data
}

export async function fetchJob(id: string) {
  const { data } = await api.get<{ job: JobDetail }>(`/jobs/${id}`)
  return data.job
}

export async function fetchMyJobs() {
  const { data } = await api.get<{ jobs: EmployerJobSummary[] }>('/employer/jobs')
  return data.jobs
}

export async function fetchMyJob(id: string) {
  const { data } = await api.get<{ job: JobDetail }>(`/employer/jobs/${id}`)
  return data.job
}

export async function createJobRequest(content: JobContent) {
  const { data } = await api.post<{ job: JobDetail }>('/employer/jobs', content)
  return data.job
}

export async function updateJobRequest(input: { id: string; content: JobContent }) {
  const { data } = await api.put<{ job: JobDetail }>(`/employer/jobs/${input.id}`, input.content)
  return data.job
}

export async function changeJobStatusRequest(input: { id: string; action: JobAction }) {
  const { data } = await api.post<{ job: JobDetail }>(`/employer/jobs/${input.id}/${input.action}`)
  return data.job
}
