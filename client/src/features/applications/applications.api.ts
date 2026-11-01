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

/** The resume the candidate applied with, as the employer sees it (no personal preferences). */
export type ApplicantResume = {
  headline: string
  summary: string
  leadershipLevel: number
  skills: { name: string; level: number; years: number }[]
  roles: {
    title: string
    company: string
    period: string
    years: number
    domain?: string
    description: string
  }[]
  education: { degreeLevel: number; field: string; institution: string; period: string }[]
  certifications: string[]
}

export type Applicant = {
  id: string
  candidateName: string
  /** The candidate's contact email, or their account email when they set none. */
  candidateEmail: string
  /** Current contact details, not frozen with the application. */
  contact: {
    phone: string
    city: string
    country: string
    links: { label: string; url: string }[]
  }
  headline: string
  totalYears: number
  status: ApplicationStatus
  matchScore: number
  engineVersion: string
  scoredAgainstOlderVersion: boolean
  createdAt: string
  resume: ApplicantResume
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
