import { api } from '@/lib/api'
import type { WorkMode } from '@/features/profile/profile.schema'
import type { CompanyRef } from '@/features/company/company.schema'

export type DimensionKey =
  | 'skills'
  | 'experience'
  | 'domain'
  | 'education'
  | 'leadership'
  | 'certifications'
export type EligibilityStatus = 'ok' | 'mismatch' | 'unknown'
export type ApplicationStatus = 'applied' | 'under_review' | 'rejected' | 'hired'

export type Dimension = { key: DimensionKey; score: number; weight: number; applicable: boolean }

export type Breakdown = {
  dimensions: Dimension[]
  missing: {
    skills: { termId: string; name: string; required: boolean }[]
    certs: { termId: string; name: string }[]
  }
  eligibility: { location: EligibilityStatus; workMode: EligibilityStatus; salary: EligibilityStatus }
}

export type Gap = Breakdown & {
  jobId: string
  engineVersion: string
  score: number
  application: { id: string; status: ApplicationStatus; matchScore: number; createdAt: string } | null
}

export type RecommendedJob = {
  id: string
  employerName: string
  company: CompanyRef | null
  title: string
  location?: string
  workMode?: WorkMode
  salaryMin?: number
  salaryMax?: number
  domainId?: string
  score: number
  eligibility: Breakdown['eligibility']
}

export async function fetchGap(jobId: string) {
  const { data } = await api.get<Gap>(`/jobs/${jobId}/gap`)
  return data
}

export async function fetchRecommended(limit = 5) {
  const { data } = await api.get<{ jobs: RecommendedJob[]; termNames: Record<string, string> }>(
    '/jobs/recommended',
    { params: { limit } },
  )
  return data
}
