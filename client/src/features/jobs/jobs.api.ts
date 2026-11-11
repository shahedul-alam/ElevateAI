import { api } from '@/lib/api'
import type { WorkMode } from '@/features/profile/profile.schema'
import type { CompanyRef } from '@/features/company/company.schema'
import type { EmploymentType, JobContent } from './jobs.schema'

export type JobStatus = 'draft' | 'active' | 'closed'
export type JobAction = 'publish' | 'unpublish' | 'close'

export type JobDetail = {
  id: string
  status: JobStatus
  publishedAt: string | null
  suspendedAt?: string | null
  suspendedReason?: string | null
  versionId: string
  content: JobContent
  termNames: Record<string, string>
  employerName?: string
  company?: CompanyRef | null
}

export type EmployerJobSummary = {
  id: string
  status: JobStatus
  title: string
  publishedAt: string | null
  /** Set while an admin has the job suspended. */
  suspendedAt?: string | null
  suspendedReason?: string | null
  updatedAt: string
}

export type JobCard = {
  id: string
  employerName: string
  company: CompanyRef | null
  title: string
  location?: string
  workMode?: WorkMode
  employmentType?: EmploymentType
  applicationDeadline?: string
  salaryMin?: number
  salaryMax?: number
  domainId?: string
  skillIds: string[]
  publishedAt: string
}

export type JobListFilters = { q: string; workMode: string; employmentType: string; domainId: string }

export async function fetchJobs(filters: JobListFilters, cursor?: string) {
  const params = {
    ...(filters.q && { q: filters.q }),
    ...(filters.workMode && { workMode: filters.workMode }),
    ...(filters.employmentType && { employmentType: filters.employmentType }),
    ...(filters.domainId &&{ domainId: filters.domainId }),
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

export type JobDraft = {
  draft: {
    title: string
    description: string
    employmentType?: EmploymentType
    responsibilities: string[]
    qualifications: string[]
    perks: string[]
    otherDetails: string[]
    skills: { termId: string; required: boolean }[]
  }
  unmappedSkills: string[]
  termNames: Record<string, string>
}

/** AI draft of the job form from pasted text. Nothing is saved. */
export async function draftJobRequest(text: string) {
  const { data } = await api.post<JobDraft>('/employer/jobs/ai-draft', { text }, { timeout: 90_000 })
  return data
}
