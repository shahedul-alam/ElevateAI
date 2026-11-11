import { z } from 'zod'

const thisYear = () => new Date().getFullYear()
/** A whole-number year from `min` to the current year, checked when the request is parsed (not when the server boots). */
const yearUpToNow = (min: number) =>
  z
    .number()
    .int()
    .min(min)
    .refine((y) => y <= thisYear(), { error: () => `Year cannot be after ${thisYear()}` })

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

const text = (max: number) => z.string().trim().max(max).default('')
const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(''), z.enum(values)]).default('')

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

// Rendered as anchors, so only http(s): a `javascript:` or `data:` link must never be storable.
const link = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || isHttpUrl(v), 'Enter a full link starting with https://')
  .default('')

const lines = z.array(z.string().trim().min(1, 'Cannot be blank').max(300)).max(20).default([])

export const linksSchema = z.object({ linkedin: link, github: link, x: link })

export const cultureItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80),
  description: z.string().trim().max(300).default(''),
})

export const awardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  issuer: text(80),
  year: yearUpToNow(1900).nullable().default(null),
})

/**
 * What an employer may edit. `verified` is deliberately absent: only an admin sets it, and Zod
 * strips unknown keys, so a payload that includes it cannot reach the database.
 */
export const companySaveSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100),
  tagline: text(160),
  about: text(3000),
  mission: text(500),
  headquarters: text(100),
  size: oneOf(COMPANY_SIZES),
  fundingStage: oneOf(FUNDING_STAGES),
  foundedYear: yearUpToNow(1800).nullable().default(null),
  website: link,
  links: linksSchema.default({ linkedin: '', github: '', x: '' }),
  culture: z.array(cultureItemSchema).max(8).default([]),
  benefits: lines,
  hubs: lines,
  awards: z.array(awardSchema).max(15).default([]),
  domainId: z
    .string()
    .regex(/^domain:[a-z0-9-]+$/, 'Invalid industry')
    .nullable()
    .default(null),
  workPolicy: z.enum(WORK_POLICIES).nullable().default(null),
})

export type CompanySaveInput = z.infer<typeof companySaveSchema>

export const verificationSchema = z.object({ verified: z.boolean() })

export const companyIdParamSchema = z.object({ id: z.uuid() })

export const companyListQuerySchema = z.object({
  q: z.string().trim().max(80).default(''),
  domainId: z
    .string()
    .regex(/^domain:[a-z0-9-]+$/)
    .optional(),
  // Opaque: issued by the server (see company.cursor.ts) and validated when used.
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>

/**
 * A verified badge vouches for a specific name, website and set of links. Changing any of them
 * revokes it until an admin looks again, so a verified company cannot be renamed into someone else.
 */
export const identityChanged = (
  current: { name: string; website: string; links: unknown },
  next: Pick<CompanySaveInput, 'name' | 'website' | 'links'>,
) => {
  const a = readLinks(current.links)
  return (
    current.name.trim() !== next.name.trim() ||
    current.website.trim() !== next.website.trim() ||
    a.linkedin !== next.links.linkedin ||
    a.github !== next.links.github ||
    a.x !== next.links.x
  )
}

/** Stored JSON may predate a field or fail a newer rule: read it back as empty, never crash. */
export const readLinks = (v: unknown) => linksSchema.safeParse(v ?? {}).data ?? linksSchema.parse({})
export const readList = <T>(schema: z.ZodType<T>, v: unknown): T[] => {
  const parsed = z.array(schema).safeParse(v ?? [])
  return parsed.success ? parsed.data : []
}
export const readLines = (v: unknown) => readList(z.string(), v)
export const readCulture = (v: unknown) => readList(cultureItemSchema, v)
export const readAwards = (v: unknown) => readList(awardSchema, v)
