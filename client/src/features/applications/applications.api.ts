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
  jobId: string
  jobTitle: string
  /** The employer's own private 1-5 rating; separate from the match score. */
  rating: number | null
  noteCount: number
  /** The photo the candidate applied with (frozen), or null. Employer-only URL. */
  photoUrl: string | null
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

/** The hiring stages in order. Rejected can follow any of them but the last. */
export const PIPELINE: ApplicationStatus[] = [
  'applied',
  'under_review',
  'technical_interview',
  'culture_fit',
  'offer',
  'hired',
]

/** Stages an application can be moved to from `from`: any later stage, or rejected. Mirrors the server. */
export const nextStatuses = (from: ApplicationStatus): ApplicationStatus[] =>
  from === 'hired' || from === 'rejected' ? [] : [...PIPELINE.slice(PIPELINE.indexOf(from) + 1), 'rejected']

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  under_review: 'Under review',
  technical_interview: 'Technical interview',
  culture_fit: 'Culture fit',
  offer: 'Offer',
  rejected: 'Rejected',
  hired: 'Hired',
}

export const STATUS_STYLE: Record<ApplicationStatus, string> = {
  applied: 'border-border text-muted-foreground',
  technical_interview: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  culture_fit: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  offer: 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300',
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

export type EmployerApplicationFilters = {
  status: ApplicationStatus | ''
  jobId: string
  q: string
  minRating: string
}

export type StatusCounts = Record<ApplicationStatus, number>

export async function fetchEmployerApplications(filters: EmployerApplicationFilters, cursor?: string) {
  // Blank filters are sent as-is: the server treats an empty value as unset.
  const { data } = await api.get<{ applicants: Applicant[]; nextCursor: string | null; counts: StatusCounts }>(
    '/employer/applications',
    { params: { ...filters, ...(cursor && { cursor }) } },
  )
  return data
}

export type ApplicationNote = { id: string; body: string; createdAt: string }

export type ApplicationActivity = {
  history: { fromStatus: ApplicationStatus | null; toStatus: ApplicationStatus; createdAt: string }[]
  notes: ApplicationNote[]
}

export async function fetchActivity(id: string) {
  const { data } = await api.get<ApplicationActivity>(`/employer/applications/${id}/activity`)
  return data
}

export async function addNoteRequest(input: { id: string; body: string }) {
  const { data } = await api.post<{ note: ApplicationNote }>(`/employer/applications/${input.id}/notes`, {
    body: input.body,
  })
  return data.note
}

export async function deleteNoteRequest(input: { id: string; noteId: string }) {
  await api.delete(`/employer/applications/${input.id}/notes/${input.noteId}`)
}

export async function setRatingRequest(input: { id: string; rating: number | null }) {
  await api.patch(`/employer/applications/${input.id}/rating`, { rating: input.rating })
}

export async function changeApplicationStatusRequest(input: { id: string; status: ApplicationStatus }) {
  const { data } = await api.patch<{ application: { id: string; status: ApplicationStatus } }>(
    `/applications/${input.id}/status`,
    { status: input.status },
  )
  return data.application
}
