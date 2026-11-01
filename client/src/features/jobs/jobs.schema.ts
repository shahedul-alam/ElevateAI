import { z } from 'zod'

import { WORK_MODES, type WorkMode } from '@/features/profile/profile.schema'

const years = z.number({ error: 'Enter a number' }).min(0, 'Must be 0 or more').max(60, 'Too large')
const optionalYears = z.string().regex(/^(\d{1,2}(\.\d{1,2})?)?$/, 'Enter years, e.g. 2 or 1.5')

// Form-level shape: optional numbers stay text until submit (see toPayload).
export const jobFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Keep it under 120 characters'),
    description: z.string().trim().min(1, 'Description is required').max(5000, 'Keep it under 5000 characters'),
    skills: z
      .array(
        z.object({
          termId: z.string(),
          required: z.boolean(),
          minLevel: z.number({ error: 'Pick a level' }).int().min(1).max(5),
          minYears: optionalYears,
        }),
      )
      .max(30),
    minYears: years,
    domainId: z.string(),
    minDomainYears: years,
    minDegreeLevel: z.number().int().min(0).max(4),
    leadershipLevel: z.number().int().min(0).max(3),
    certIds: z.array(z.string()).max(30),
    location: z.string().trim().max(80),
    workMode: z.union([z.literal(''), z.enum(WORK_MODES)]),
    salaryMin: z.string().regex(/^\d{0,9}$/, 'Digits only'),
    salaryMax: z.string().regex(/^\d{0,9}$/, 'Digits only'),
  })
  .refine((j) => j.salaryMin === '' || j.salaryMax === '' || Number(j.salaryMin) <= Number(j.salaryMax), {
    path: ['salaryMax'],
    message: 'Maximum must be at least the minimum',
  })

export type JobFormValues = z.infer<typeof jobFormSchema>

/** Shape the API stores and returns (mirrors the server's jobContentSchema). */
export type JobContent = {
  title: string
  description: string
  skills: { termId: string; required: boolean; minLevel: number; minYears?: number }[]
  minYears: number
  domainId?: string
  minDomainYears: number
  minDegreeLevel: number
  leadershipLevel: number
  certIds: string[]
  location?: string
  workMode?: WorkMode
  salaryMin?: number
  salaryMax?: number
}

export const emptyJobForm: JobFormValues = {
  title: '',
  description: '',
  skills: [],
  minYears: 0,
  domainId: '',
  minDomainYears: 0,
  minDegreeLevel: 0,
  leadershipLevel: 0,
  certIds: [],
  location: '',
  workMode: '',
  salaryMin: '',
  salaryMax: '',
}

const optionalNumber = (n?: number) => (n !== undefined ? String(n) : '')

export const toJobForm = (c: JobContent): JobFormValues => ({
  title: c.title,
  description: c.description,
  skills: c.skills.map((s) => ({
    termId: s.termId,
    required: s.required,
    minLevel: s.minLevel,
    minYears: optionalNumber(s.minYears),
  })),
  minYears: c.minYears,
  domainId: c.domainId ?? '',
  minDomainYears: c.minDomainYears,
  minDegreeLevel: c.minDegreeLevel,
  leadershipLevel: c.leadershipLevel,
  certIds: c.certIds,
  location: c.location ?? '',
  workMode: c.workMode ?? '',
  salaryMin: optionalNumber(c.salaryMin),
  salaryMax: optionalNumber(c.salaryMax),
})

export const toJobPayload = (v: JobFormValues): JobContent => ({
  title: v.title,
  description: v.description,
  skills: v.skills.map((s) => ({
    termId: s.termId,
    required: s.required,
    minLevel: s.minLevel,
    ...(s.minYears !== '' && { minYears: Number(s.minYears) }),
  })),
  minYears: v.minYears,
  ...(v.domainId && { domainId: v.domainId }),
  minDomainYears: v.minDomainYears,
  minDegreeLevel: v.minDegreeLevel,
  leadershipLevel: v.leadershipLevel,
  certIds: v.certIds,
  ...(v.location && { location: v.location }),
  ...(v.workMode && { workMode: v.workMode }),
  ...(v.salaryMin !== '' && { salaryMin: Number(v.salaryMin) }),
  ...(v.salaryMax !== '' && { salaryMax: Number(v.salaryMax) }),
})
