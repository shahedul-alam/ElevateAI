import { z } from 'zod'

export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const
export type WorkMode = (typeof WORK_MODES)[number]

export const LEVEL_LABELS = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'] as const
// Index is the degree level the engine scores (0 = none).
export const DEGREE_LABELS = ['None', 'Diploma or associate', 'Bachelor', 'Master', 'Doctorate'] as const
export const LEADERSHIP_LABELS = ['None', 'Team lead', 'Manager', 'Director or above'] as const

const years = z.number({ error: 'Enter a number' }).min(0, 'Must be 0 or more').max(60, 'Too large')

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

// Mirrors the server: only http(s) links are accepted, since employers see them as anchors.
const link = z
  .string()
  .trim()
  .max(200, 'Keep it under 200 characters')
  .refine((v) => v === '' || isHttpUrl(v), 'Enter a full link starting with https://')

/** Contact details live outside the versioned resume: they are current, editable and never scored. */
export const contactFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(30, 'Keep it under 30 characters')
    .refine((v) => v === '' || /^\+?[0-9\s().-]{5,25}$/.test(v), 'Enter a valid phone number'),
  email: z
    .string()
    .trim()
    .max(254, 'Too long')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
  city: z.string().trim().max(80, 'Keep it under 80 characters'),
  country: z.string().trim().max(80, 'Keep it under 80 characters'),
  linkedin: link,
  github: link,
  website: link,
  other: link,
})

export type Contact = z.infer<typeof contactFormSchema>

export const emptyContact: Contact = {
  phone: '',
  email: '',
  city: '',
  country: '',
  linkedin: '',
  github: '',
  website: '',
  other: '',
}

// Form-level shape: comma-separated lists and the salary stay text until submit (see toPayload).
export const profileFormSchema = z.object({
  contact: contactFormSchema,
  headline: z.string().trim().max(120, 'Keep it under 120 characters'),
  summary: z.string().trim().max(2000, 'Keep it under 2000 characters'),
  skills: z
    .array(
      z.object({
        termId: z.string(),
        level: z.number({ error: 'Pick a level' }).int().min(1).max(5),
        years,
      }),
    )
    .max(50),
  roles: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'Title is required').max(100),
        years,
        domainId: z.string(),
        company: z.string().trim().max(100, 'Keep it under 100 characters'),
        period: z.string().trim().max(60, 'Keep it under 60 characters'),
        description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({
        degreeLevel: z.number({ error: 'Pick a degree' }).int().min(1).max(4),
        field: z.string().trim().max(100, 'Keep it under 100 characters'),
        institution: z.string().trim().max(100, 'Keep it under 100 characters'),
        period: z.string().trim().max(60, 'Keep it under 60 characters'),
      }),
    )
    .max(10),
  leadershipLevel: z.number().int().min(0).max(3),
  certIds: z.array(z.string()).max(30),
  unmappedText: z.string().max(1000),
  locationsText: z.string().max(500),
  workModes: z.array(z.enum(WORK_MODES)),
  minSalary: z.string().regex(/^\d*$/, 'Digits only').max(9, 'Too large'),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

/** Shape the API stores and returns (mirrors the server's profileContentSchema). */
export type ProfileContent = {
  headline: string
  summary: string
  skills: { termId: string; level: number; years: number }[]
  roles: {
    title: string
    years: number
    domainId?: string
    company: string
    period: string
    description: string
  }[]
  education: { degreeLevel: number; field: string; institution: string; period: string }[]
  leadershipLevel: number
  certIds: string[]
  unmapped: string[]
  preferences: { locations: string[]; workModes: WorkMode[]; minSalary?: number }
}

const splitList = (text: string) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const emptyForm: ProfileFormValues = {
  contact: emptyContact,
  headline: '',
  summary: '',
  skills: [],
  roles: [],
  education: [],
  leadershipLevel: 0,
  certIds: [],
  unmappedText: '',
  locationsText: '',
  workModes: [],
  minSalary: '',
}

export const toForm = (c: ProfileContent, contact: Contact): ProfileFormValues => ({
  contact,
  headline: c.headline,
  summary: c.summary,
  skills: c.skills,
  roles: c.roles.map((r) => ({ ...r, domainId: r.domainId ?? '' })),
  education: c.education,
  leadershipLevel: c.leadershipLevel,
  certIds: c.certIds,
  unmappedText: c.unmapped.join(', '),
  locationsText: c.preferences.locations.join(', '),
  workModes: c.preferences.workModes,
  minSalary: c.preferences.minSalary !== undefined ? String(c.preferences.minSalary) : '',
})

/** What a save sends: the versioned resume plus the separately stored contact details. */
export type ProfileSavePayload = ProfileContent & { contact: Contact }

export const toPayload = (v: ProfileFormValues): ProfileSavePayload => ({
  contact: v.contact,
  headline: v.headline,
  summary: v.summary,
  skills: v.skills,
  roles: v.roles.map((r) => ({
    title: r.title,
    years: r.years,
    ...(r.domainId && { domainId: r.domainId }),
    company: r.company,
    period: r.period,
    description: r.description,
  })),
  education: v.education,
  leadershipLevel: v.leadershipLevel,
  certIds: v.certIds,
  unmapped: splitList(v.unmappedText),
  preferences: {
    locations: splitList(v.locationsText),
    workModes: v.workModes,
    ...(v.minSalary !== '' && { minSalary: Number(v.minSalary) }),
  },
})
