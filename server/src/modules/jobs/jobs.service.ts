import { prisma } from '../../config/db'
import { hashContent } from '../../lib/content-hash'
import { HttpError } from '../../middleware/errors'
import type { Prisma } from '../../../generated/prisma/client'
import { assertApprovedTerms, termNamesFor } from '../catalog/catalog.service'
import { canonicalizeJob, hasScoredRequirement } from './jobs.canonical'
import { parseStoredJob, type JobInput, type JobListQuery } from './jobs.schema'

type JobRow = {
  id: string
  status: 'draft' | 'active' | 'closed'
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
type VersionRow = { id: string; content: unknown }

const contentOf = (v: VersionRow) => parseStoredJob(v.content)

const jobTermIds = (c: JobInput) => [
  ...c.skills.map((s) => s.termId),
  ...(c.domainId ? [c.domainId] : []),
  ...c.certIds,
]

async function toDto(job: JobRow, version: VersionRow) {
  const content = contentOf(version)
  return {
    id: job.id,
    status: job.status,
    publishedAt: job.publishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    versionId: version.id,
    content,
    termNames: await termNamesFor(jobTermIds(content)),
  }
}

async function assertCatalogTerms(input: JobInput) {
  const wanted = new Map<string, string>()
  input.skills.forEach((s, i) => wanted.set(s.termId, `skills.${i}.termId`))
  if (input.domainId) wanted.set(input.domainId, 'domainId')
  input.certIds.forEach((c, i) => wanted.set(c, `certIds.${i}`))
  await assertApprovedTerms(wanted)
}

const requireRequirement = (content: JobInput) => {
  if (!hasScoredRequirement(content)) {
    throw new HttpError(400, 'Add at least one requirement (skill, experience, domain, leadership or certification)')
  }
}

/** Finds the employer's own job (404 for anyone else's) with its current version. */
async function loadOwned(employerId: string, id: string) {
  const job = await prisma.job.findFirst({
    where: { id, employerId },
    include: { currentVersion: true },
  })
  if (!job?.currentVersion) throw new HttpError(404, 'Job not found')
  return { job, version: job.currentVersion }
}

/** Saving content that already exists as a version reuses that row (and makes it current). */
async function saveVersion(tx: Prisma.TransactionClient, jobId: string, content: JobInput) {
  const canonical = canonicalizeJob(content)
  const contentHash = hashContent(canonical)
  const version = await tx.jobVersion.upsert({
    where: { jobId_contentHash: { jobId, contentHash } },
    update: {},
    create: { jobId, contentHash, content: canonical },
  })
  const job = await tx.job.update({ where: { id: jobId }, data: { currentVersionId: version.id } })
  return { job, version }
}

export async function createJob(employerId: string, input: JobInput) {
  await assertCatalogTerms(input)
  const { job, version } = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({ data: { employerId } })
    return saveVersion(tx, created.id, input)
  })
  return toDto(job, version)
}

export async function listEmployerJobs(employerId: string) {
  const jobs = await prisma.job.findMany({
    where: { employerId },
    include: { currentVersion: true },
    orderBy: { updatedAt: 'desc' },
  })
  return jobs.map((j) => ({
    id: j.id,
    status: j.status,
    title: j.currentVersion ? contentOf(j.currentVersion).title : '',
    publishedAt: j.publishedAt,
    updatedAt: j.updatedAt,
  }))
}

export async function getEmployerJob(employerId: string, id: string) {
  const { job, version } = await loadOwned(employerId, id)
  return toDto(job, version)
}

export async function updateJob(employerId: string, id: string, input: JobInput) {
  const { job } = await loadOwned(employerId, id)
  if (job.status === 'closed') throw new HttpError(409, 'A closed job cannot be edited')
  await assertCatalogTerms(input)
  // An active job is public and ranks applicants, so it may not drop to a requirement-free post.
  if (job.status === 'active') requireRequirement(input)

  const saved = await prisma.$transaction((tx) => saveVersion(tx, id, input))
  return toDto(saved.job, saved.version)
}

const TRANSITIONS = {
  publish: { from: 'draft', to: 'active' },
  unpublish: { from: 'active', to: 'draft' },
  close: { from: 'active', to: 'closed' },
} as const

export type JobAction = keyof typeof TRANSITIONS

export async function changeJobStatus(employerId: string, id: string, action: JobAction) {
  const { job, version } = await loadOwned(employerId, id)
  const { from, to } = TRANSITIONS[action]
  if (job.status !== from) throw new HttpError(409, `Cannot ${action} a ${job.status} job`)
  if (action === 'publish') requireRequirement(contentOf(version))

  // The status guard in the WHERE keeps two concurrent changes from both succeeding.
  const { count } = await prisma.job.updateMany({
    where: { id, employerId, status: from },
    data: { status: to, ...(action === 'publish' && { publishedAt: new Date() }) },
  })
  if (count === 0) throw new HttpError(409, `Cannot ${action} this job right now`)
  return getEmployerJob(employerId, id)
}

export async function listPublicJobs(query: JobListQuery) {
  const and: Prisma.JobVersionWhereInput[] = []
  if (query.q) {
    and.push({
      OR: [
        { content: { path: ['title'], string_contains: query.q, mode: 'insensitive' } },
        { content: { path: ['description'], string_contains: query.q, mode: 'insensitive' } },
      ],
    })
  }
  if (query.workMode) and.push({ content: { path: ['workMode'], equals: query.workMode } })
  if (query.domainId) and.push({ content: { path: ['domainId'], equals: query.domainId } })

  const rows = await prisma.job.findMany({
    where: { status: 'active', currentVersion: { AND: and } },
    include: { currentVersion: true, employer: { select: { name: true } } },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  })
  const page = rows.slice(0, query.limit)

  const cards = page.flatMap((j) => (j.currentVersion ? [{ job: j, content: contentOf(j.currentVersion) }] : []))
  // Show up to five skills per card, required ones first.
  const topSkills = (c: JobInput) =>
    [...c.skills].sort((a, b) => Number(b.required) - Number(a.required)).slice(0, 5).map((s) => s.termId)
  const termNames = await termNamesFor(
    cards.flatMap(({ content }) => [...topSkills(content), ...(content.domainId ? [content.domainId] : [])]),
  )

  return {
    jobs: cards.map(({ job, content }) => ({
      id: job.id,
      employerName: job.employer.name,
      title: content.title,
      location: content.location,
      workMode: content.workMode,
      salaryMin: content.salaryMin,
      salaryMax: content.salaryMax,
      domainId: content.domainId,
      skillIds: topSkills(content),
      publishedAt: job.publishedAt,
    })),
    termNames,
    nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
  }
}

export async function getPublicJob(id: string) {
  const job = await prisma.job.findFirst({
    where: { id, status: 'active' },
    include: { currentVersion: true, employer: { select: { name: true } } },
  })
  if (!job?.currentVersion) throw new HttpError(404, 'Job not found')
  return { ...(await toDto(job, job.currentVersion)), employerName: job.employer.name }
}
