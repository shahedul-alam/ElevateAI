import { z } from 'zod'

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const
export const FUNDING_STAGES = [
  'Bootstrapped',
  'Pre-seed',
  'Seed',
  'Series A',
  'Series B',
  'Series C+',
  'Public',
  'Non-profit',
] as const
export const WORK_POLICIES = ['onsite', 'hybrid', 'remote_first'] as const
export type WorkPolicy = (typeof WORK_POLICIES)[number]
export const WORK_POLICY_LABELS: Record<WorkPolicy, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote_first: 'Remote-first',
}

export const IMAGE_LIMITS = { logo: 512 * 1024, cover: 2 * 1024 * 1024 } as const
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'

const link = z
  .string()
  .trim()
  .max(200, 'Keep it under 200 characters')
  .refine((v) => {
    if (v === '') return true
    try {
      const { protocol } = new URL(v)
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }, 'Enter a full link starting with https://')

const row = z.object({ value: z.string().trim().max(300, 'Keep it under 300 characters') })
const thisYear = new Date().getFullYear()
const year = (min: number, label: string) =>
  z
    .string()
    .regex(/^(\d{4})?$/, 'Enter a 4-digit year')
    .refine((v) => v === '' || (Number(v) >= min && Number(v) <= thisYear), label)

export const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100, 'Keep it under 100 characters'),
  tagline: z.string().trim().max(160, 'Keep it under 160 characters'),
  about: z.string().trim().max(3000, 'Keep it under 3000 characters'),
  mission: z.string().trim().max(500, 'Keep it under 500 characters'),
  headquarters: z.string().trim().max(100, 'Keep it under 100 characters'),
  size: z.union([z.literal(''), z.enum(COMPANY_SIZES)]),
  fundingStage: z.union([z.literal(''), z.enum(FUNDING_STAGES)]),
  foundedYear: year(1800, `Enter a year between 1800 and ${thisYear}`),
  domainId: z.string(),
  workPolicy: z.union([z.literal(''), z.enum(WORK_POLICIES)]),
  website: link,
  linkedin: link,
  github: link,
  x: link,
  culture: z
    .array(
      z.object({
        title: z.string().trim().max(80, 'Keep it under 80 characters'),
        description: z.string().trim().max(300, 'Keep it under 300 characters'),
      }),
    )
    .max(8, 'At most 8 items'),
  awards: z
    .array(
      z.object({
        title: z.string().trim().max(120, 'Keep it under 120 characters'),
        issuer: z.string().trim().max(80, 'Keep it under 80 characters'),
        year: year(1900, `Enter a year between 1900 and ${thisYear}`),
      }),
    )
    .max(15, 'At most 15 items'),
  benefits: z.array(row).max(20, 'At most 20 items'),
  hubs: z.array(row).max(20, 'At most 20 items'),
})

export type CompanyFormValues = z.infer<typeof companyFormSchema>

export type CompanyLinks = { linkedin: string; github: string; x: string }

/** What the API returns (mirrors the server's company DTO). */
export type Company = {
  id: string
  name: string
  tagline: string
  about: string
  mission: string
  headquarters: string
  size: string
  fundingStage: string
  foundedYear: number | null
  website: string
  links: CompanyLinks
  culture: { title: string; description: string }[]
  benefits: string[]
  hubs: string[]
  awards: { title: string; issuer: string; year: number | null }[]
  domainId: string | null
  workPolicy: WorkPolicy | null
  verified: boolean
  logoUrl: string | null
  coverUrl: string | null
}

/** The slice of a company that job cards and job pages carry. */
export type CompanyRef = {
  id: string
  name: string
  tagline: string
  verified: boolean
  logoUrl: string | null
}

export const emptyCompanyForm: CompanyFormValues = {
  name: '',
  tagline: '',
  about: '',
  mission: '',
  headquarters: '',
  size: '',
  fundingStage: '',
  foundedYear: '',
  domainId: '',
  workPolicy: '',
  website: '',
  linkedin: '',
  github: '',
  x: '',
  culture: [],
  awards: [],
  benefits: [],
  hubs: [],
}

const asRows = (items: string[]) => items.map((value) => ({ value }))
const fromRows = (rows: { value: string }[]) => rows.map((r) => r.value.trim()).filter(Boolean)

export const toCompanyForm = (c: Company): CompanyFormValues => ({
  name: c.name,
  tagline: c.tagline,
  about: c.about,
  mission: c.mission,
  headquarters: c.headquarters,
  size: (c.size as CompanyFormValues['size']) || '',
  fundingStage: (c.fundingStage as CompanyFormValues['fundingStage']) || '',
  foundedYear: c.foundedYear ? String(c.foundedYear) : '',
  domainId: c.domainId ?? '',
  workPolicy: c.workPolicy ?? '',
  website: c.website,
  linkedin: c.links.linkedin,
  github: c.links.github,
  x: c.links.x,
  culture: c.culture,
  awards: c.awards.map((a) => ({ title: a.title, issuer: a.issuer, year: a.year ? String(a.year) : '' })),
  benefits: asRows(c.benefits),
  hubs: asRows(c.hubs),
})

export const toCompanyPayload = (v: CompanyFormValues) => ({
  name: v.name,
  tagline: v.tagline,
  about: v.about,
  mission: v.mission,
  headquarters: v.headquarters,
  size: v.size,
  fundingStage: v.fundingStage,
  foundedYear: v.foundedYear ? Number(v.foundedYear) : null,
  website: v.website,
  links: { linkedin: v.linkedin, github: v.github, x: v.x },
  culture: v.culture.filter((c) => c.title.trim() !== ''),
  benefits: fromRows(v.benefits),
  hubs: fromRows(v.hubs),
  awards: v.awards
    .filter((a) => a.title.trim() !== '')
    .map((a) => ({ title: a.title, issuer: a.issuer, year: a.year ? Number(a.year) : null })),
  domainId: v.domainId || null,
  workPolicy: v.workPolicy || null,
})

/** Preview shape: what the page would show if the form were saved now (images are saved separately). */
export const previewCompany = (v: CompanyFormValues, saved: Company): Company => {
  const p = toCompanyPayload({ ...emptyCompanyForm, ...v })
  const finite = (n: number | null) => (n !== null && Number.isFinite(n) ? n : null)
  return {
    ...saved,
    ...p,
    name: p.name || saved.name,
    foundedYear: finite(p.foundedYear),
    awards: p.awards.map((a) => ({ ...a, year: finite(a.year) })),
    workPolicy: p.workPolicy as WorkPolicy | null,
  }
}
