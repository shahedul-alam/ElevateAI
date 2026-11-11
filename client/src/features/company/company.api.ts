import { api } from '@/lib/api'
import type { JobCard } from '@/features/jobs/jobs.api'

import type { Company } from './company.schema'
import type { toCompanyPayload } from './company.schema'

export type CompanyCard = {
  id: string
  name: string
  tagline: string
  headquarters: string
  domainId: string | null
  verified: boolean
  logoUrl: string | null
  openPositions: number
}

export type CompanyFilters = { q: string; domainId: string }

export async function fetchCompanies(filters: CompanyFilters, cursor?: string) {
  const params = {
    ...(filters.q && { q: filters.q }),
    ...(filters.domainId && { domainId: filters.domainId }),
    ...(cursor && { cursor }),
  }
  const { data } = await api.get<{
    companies: CompanyCard[]
    termNames: Record<string, string>
    nextCursor: string | null
  }>('/companies', { params })
  return data
}

export type PublicCompany = {
  company: Company
  jobs: JobCard[]
  termNames: Record<string, string>
}

export async function fetchCompany(id: string) {
  const { data } = await api.get<PublicCompany>(`/companies/${id}`)
  return data
}

export async function fetchMyCompany() {
  const { data } = await api.get<{ company: Company }>('/employer/company')
  return data.company
}

export async function saveMyCompany(payload: ReturnType<typeof toCompanyPayload>) {
  const { data } = await api.put<{ company: Company }>('/employer/company', payload)
  return data.company
}

export async function uploadCompanyImage(input: { kind: 'logo' | 'cover'; file: File }) {
  const { data } = await api.put<{ company: Company }>(`/employer/company/${input.kind}`, input.file, {
    headers: { 'Content-Type': input.file.type },
  })
  return data.company
}

export async function removeCompanyImage(kind: 'logo' | 'cover') {
  const { data } = await api.delete<{ company: Company }>(`/employer/company/${kind}`)
  return data.company
}

export async function setCompanyVerified(input: { id: string; verified: boolean }) {
  const { data } = await api.patch<{ id: string; verified: boolean }>(
    `/admin/companies/${input.id}/verification`,
    { verified: input.verified },
  )
  return data
}
