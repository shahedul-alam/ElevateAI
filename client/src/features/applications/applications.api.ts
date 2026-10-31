import { api } from '@/lib/api'
import type { ApplicationStatus, Breakdown } from '@/features/matching/matching.api'

export type MyApplication = {
  id: string
  jobId: string
  jobStatus: 'draft' | 'active' | 'closed'
  title: string
  status: ApplicationStatus
  matchScore: number
  engineVersion: string
  createdAt: string
}

export type Applicant = {
  id: string
  candidateName: string
  candidateEmail: string
  headline: string
  totalYears: number
  status: ApplicationStatus
  matchScore: number
  engineVersion: string
  scoredAgainstOlderVersion: boolean
  createdAt: string
  breakdown: Breakdown
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  under_review: 'Under review',
  rejected: 'Rejected',
  hired: 'Hired',
}

export async function applyRequest(jobId: string) {
  const { data } = await api.post<{ application: { id: string; matchScore: number } }>(`/jobs/${jobId}/apply`)
  return data.application
}

export async function fetchMyApplications() {
  const { data } = await api.get<{ applications: MyApplication[] }>('/candidate/applications')
  return data.applications
}

export async function fetchApplicants(jobId: string, cursor?: string) {
  const { data } = await api.get<{ applicants: Applicant[]; nextCursor: string | null }>(
    `/employer/jobs/${jobId}/applicants`,
    { params: cursor ? { cursor } : {} },
  )
  return data
}

export async function changeApplicationStatusRequest(input: { id: string; status: Exclude<ApplicationStatus, 'applied'> }) {
  const { data } = await api.patch<{ application: { id: string; status: ApplicationStatus } }>(
    `/applications/${input.id}/status`,
    { status: input.status },
  )
  return data.application
}
