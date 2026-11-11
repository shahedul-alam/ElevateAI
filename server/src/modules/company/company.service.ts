import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { Prisma } from '../../../generated/prisma/client'
import { assertApprovedTerms, termNamesFor } from '../catalog/catalog.service'
import { listPublicJobs } from '../jobs/jobs.service'
import {
  deleteImage,
  detectImageType,
  getImage,
  getImageMeta,
  IMAGE_LIMITS,
  saveImage,
  type ImageKind,
} from './company.images'
import { DIRECTORY_ORDER, afterPosition, decodeCursor, encodeCursor } from './company.cursor'
import { imageUrl } from './company.ref'
import {
  readAwards,
  readCulture,
  readLines,
  identityChanged,
  readLinks,
  type CompanyListQuery,
  type CompanySaveInput,
} from './company.schema'

const withImages = { images: { select: { kind: true, etag: true } } } as const
type CompanyRow = Prisma.CompanyGetPayload<{ include: typeof withImages }>
type Owner = { id: string; name: string }

const toDto = (c: CompanyRow) => ({
  id: c.id,
  name: c.name,
  tagline: c.tagline,
  about: c.about,
  mission: c.mission,
  headquarters: c.headquarters,
  size: c.size,
  fundingStage: c.fundingStage,
  foundedYear: c.foundedYear,
  website: c.website,
  links: readLinks(c.links),
  culture: readCulture(c.culture),
  benefits: readLines(c.benefits),
  hubs: readLines(c.hubs),
  awards: readAwards(c.awards),
  domainId: c.domainId,
  workPolicy: c.workPolicy as 'onsite' | 'hybrid' | 'remote_first' | null,
  verified: c.verified,
  logoUrl: imageUrl(c.id, 'logo', c.images),
  coverUrl: imageUrl(c.id, 'cover', c.images),
})

/** Every employer has a company: created with the account, and here as a safety net for older accounts. */
export const ensureCompany = (ownerId: string, name: string) =>
  prisma.company.upsert({
    where: { ownerId },
    create: { ownerId, name },
    update: {},
    include: withImages,
  })

export async function getOwnCompany(user: Owner) {
  return toDto(await ensureCompany(user.id, user.name))
}

export async function saveOwnCompany(user: Owner, input: CompanySaveInput) {
  if (input.domainId) await assertApprovedTerms(new Map([[input.domainId, 'domainId']]))
  const current = await ensureCompany(user.id, user.name)
  const revoke = current.verified && identityChanged(current, input)
  const saved = await prisma.company.update({
    where: { id: current.id },
    data: { ...input, ...(revoke && { verified: false }) },
    include: withImages,
  })
  return toDto(saved)
}

export async function uploadOwnImage(user: Owner, kind: ImageKind, body: unknown) {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new HttpError(415, 'Send the image as PNG, JPEG or WebP')
  }
  if (body.length > IMAGE_LIMITS[kind]) {
    throw new HttpError(413, `The ${kind} must be under ${IMAGE_LIMITS[kind] / 1024} KB`)
  }
  const type = detectImageType(body)
  if (!type) throw new HttpError(415, 'The file must be a PNG, JPEG or WebP image')
  const { id } = await ensureCompany(user.id, user.name)
  await saveImage(id, kind, body, type)
  return getOwnCompany(user)
}

export async function removeOwnImage(user: Owner, kind: ImageKind) {
  const { id } = await ensureCompany(user.id, user.name)
  await deleteImage(id, kind)
  return getOwnCompany(user)
}

export async function getPublicCompany(id: string) {
  const company = await prisma.company.findFirst({
    where: { id, owner: { suspendedAt: null } },
    include: withImages,
  })
  if (!company) throw new HttpError(404, 'Company not found')
  const dto = toDto(company)
  const positions = await listPublicJobs({ q: '', companyId: id, limit: 50 })
  const names = await termNamesFor(dto.domainId ? [dto.domainId] : [])
  return { company: dto, jobs: positions.jobs, termNames: { ...positions.termNames, ...names } }
}

export async function listCompanies(query: CompanyListQuery) {
  const position = query.cursor ? decodeCursor(query.cursor) : null
  if (query.cursor && !position) throw new HttpError(400, 'Invalid cursor')
  const rows = await prisma.company.findMany({
    where: {
      owner: { suspendedAt: null },
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
      ...(query.domainId && { domainId: query.domainId }),
      ...(position && afterPosition(position)),
    },
    include: withImages,
    orderBy: DIRECTORY_ORDER,
    take: query.limit + 1,
  })
  const page = rows.slice(0, query.limit)
  const counts = await prisma.job.groupBy({
    by: ['employerId'],
    where: { status: 'active', suspendedAt: null, employerId: { in: page.map((c) => c.ownerId) } },
    _count: { _all: true },
  })
  const open = new Map(counts.map((c) => [c.employerId, c._count._all]))
  const termNames = await termNamesFor(page.flatMap((c) => (c.domainId ? [c.domainId] : [])))
  return {
    companies: page.map((c) => ({
      id: c.id,
      name: c.name,
      tagline: c.tagline,
      headquarters: c.headquarters,
      domainId: c.domainId,
      verified: c.verified,
      logoUrl: imageUrl(c.id, 'logo', c.images),
      openPositions: open.get(c.ownerId) ?? 0,
    })),
    termNames,
    nextCursor: rows.length > query.limit ? encodeCursor(page[page.length - 1]!) : null,
  }
}

export async function setVerified(id: string, verified: boolean) {
  const { count } = await prisma.company.updateMany({ where: { id }, data: { verified } })
  if (count === 0) throw new HttpError(404, 'Company not found')
  return { id, verified }
}

/** Always called before `getPublicImage`, so this is also where a suspended owner's images are hidden. */
export async function getPublicImageMeta(id: string, kind: ImageKind) {
  const [meta, visible] = await Promise.all([
    getImageMeta(id, kind),
    prisma.company.count({ where: { id, owner: { suspendedAt: null } } }),
  ])
  if (!meta || !visible) throw new HttpError(404, 'Not found')
  return meta
}

export async function getPublicImage(id: string, kind: ImageKind) {
  const image = await getImage(id, kind)
  if (!image) throw new HttpError(404, 'Not found')
  return image
}
