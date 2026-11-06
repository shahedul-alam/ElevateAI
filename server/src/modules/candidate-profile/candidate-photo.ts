import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import { detectImageType } from '../company/company.images'

// Everything that touches photo storage lives here, so object storage can replace Postgres later.
// react-pdf cannot draw WebP, so only PNG and JPEG are accepted.
export const PHOTO_TYPES = ['image/png', 'image/jpeg']
export const PHOTO_LIMIT = 512 * 1024

/** Checks an upload and decides its type from the bytes (the client-supplied header is not trusted). */
export function validatePhoto(body: unknown): { data: Buffer; contentType: string } {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(415, 'Send the photo as PNG or JPEG')
  if (body.length > PHOTO_LIMIT) throw new HttpError(413, `The photo must be under ${PHOTO_LIMIT / 1024} KB`)
  const contentType = detectImageType(body)
  if (!contentType || !PHOTO_TYPES.includes(contentType)) {
    throw new HttpError(415, 'The photo must be a PNG or JPEG image')
  }
  return { data: body, contentType }
}

export const candidatePhotoUrl = (photoId: string | null | undefined) =>
  photoId ? `/api/candidate/profile/photo?v=${photoId}` : null

export const applicationPhotoUrl = (applicationId: string, photoId: string | null | undefined) =>
  photoId ? `/api/employer/applications/${applicationId}/photo?v=${photoId}` : null

/** Drops a blob once no profile or application points at it. */
const deleteIfUnused = (id: string) =>
  prisma.photoBlob.deleteMany({ where: { id, profiles: { none: {} }, applications: { none: {} } } })

export async function savePhoto(userId: string, body: unknown) {
  const { data, contentType } = validatePhoto(body)
  const id = createHash('sha256').update(data).digest('hex')
  const previous = await prisma.candidateProfile.findUnique({ where: { userId }, select: { photoId: true } })
  await prisma.photoBlob.upsert({
    where: { id },
    create: { id, contentType, data: new Uint8Array(data) },
    update: {},
  })
  await prisma.candidateProfile.upsert({ where: { userId }, create: { userId, photoId: id }, update: { photoId: id } })
  if (previous?.photoId && previous.photoId !== id) await deleteIfUnused(previous.photoId)
  return { photoUrl: candidatePhotoUrl(id) }
}

export async function removePhoto(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { photoId: true } })
  if (!profile?.photoId) return { photoUrl: null }
  await prisma.candidateProfile.update({ where: { userId }, data: { photoId: null } })
  await deleteIfUnused(profile.photoId)
  return { photoUrl: null }
}

export async function getPhotoInfo(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { photoId: true } })
  return { photoUrl: candidatePhotoUrl(profile?.photoId) }
}

/** Sends a stored photo. The id is the content hash, so the etag check never needs the bytes. */
export async function sendPhoto(req: Request, res: Response, photoId: string | null | undefined) {
  if (!photoId) throw new HttpError(404, 'No photo')
  const etag = `"${photoId}"`
  // Private: the route is behind a login, so shared caches must not keep it.
  res.set({
    'Cache-Control': 'private, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return
  }
  const blob = await prisma.photoBlob.findUnique({ where: { id: photoId } })
  if (!blob) throw new HttpError(404, 'No photo')
  res.type(blob.contentType).send(Buffer.from(blob.data))
}

export async function sendCandidatePhoto(req: Request, res: Response, userId: string) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { photoId: true } })
  await sendPhoto(req, res, profile?.photoId)
}

/** Employer view: only for an application on one of their own jobs. */
export async function sendApplicationPhoto(req: Request, res: Response, employerId: string, id: string) {
  const application = await prisma.application.findFirst({
    where: { id, job: { employerId } },
    select: { photoId: true },
  })
  if (!application) throw new HttpError(404, 'Application not found')
  await sendPhoto(req, res, application.photoId)
}
