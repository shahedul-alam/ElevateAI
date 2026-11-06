import { api } from '@/lib/api'
import type { CompanyRef } from '@/features/company/company.schema'
import type { EmploymentType } from '@/features/jobs/jobs.schema'
import type { ApplicationStatus, Breakdown } from '@/features/matching/matching.api'
import type { WorkMode } from '@/features/profile/profile.schema'

export type MyApplication = {
  id: string
  jobId: string
  jobStatus: 'draft' | 'active' | 'closed'
  title: string
  employerName: string
  company: CompanyRef | null
  location?: string
  workMode?: WorkMode
  employmentType?: EmploymentType
  salaryMin?: number
  salaryMax?: number
  domainId?: string
  skillIds: string[]
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

export const STATUS_STYLE: Record<ApplicationStatus, string> = {
  applied: 'border-border text-muted-foreground',
  under_review: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  rejected: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  hired: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300',
}

export async function applyRequest(jobId: string) {
  const { data } = await api.post<{ application: { id: string; matchScore: number } }>(`/jobs/${jobId}/apply`)
  return data.application
}

export async function fetchMyApplications() {
  const { data } = await api.get<{ applications: MyApplication[]; termNames: Record<string, string> }>(
    '/candidate/applications',
  )
  return data
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
