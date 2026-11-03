import { createHash } from 'node:crypto'
import { prisma } from '../../config/db'

export type ImageKind = 'logo' | 'cover'
export const IMAGE_KINDS: ImageKind[] = ['logo', 'cover']
export const IMAGE_LIMITS: Record<ImageKind, number> = { logo: 512 * 1024, cover: 2 * 1024 * 1024 }
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Decides the type from the file's own bytes: the Content-Type header and file name are client-supplied. */
export function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp'
  return null
}

// Everything that touches image storage lives here, so object storage (S3, Cloudinary) can replace
// Postgres by changing only these functions.
export async function saveImage(companyId: string, kind: ImageKind, data: Buffer, contentType: string) {
  const bytes = new Uint8Array(data) // plain ArrayBuffer-backed copy, which is what Prisma's Bytes type wants
  const etag = createHash('sha256').update(data).digest('hex').slice(0, 16)
  await prisma.companyImage.upsert({
    where: { companyId_kind: { companyId, kind } },
    create: { companyId, kind, data: bytes, contentType, etag },
    update: { data: bytes, contentType, etag },
  })
}

export const getImage = (companyId: string, kind: ImageKind) =>
  prisma.companyImage.findUnique({ where: { companyId_kind: { companyId, kind } } })

/** Just the etag and type: lets a conditional request answer 304 without reading the image bytes. */
export const getImageMeta = (companyId: string, kind: ImageKind) =>
  prisma.companyImage.findUnique({
    where: { companyId_kind: { companyId, kind } },
    select: { etag: true, contentType: true },
  })

export const deleteImage = (companyId: string, kind: ImageKind) =>
  prisma.companyImage.deleteMany({ where: { companyId, kind } })
