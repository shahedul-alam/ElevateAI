import type { RequestHandler } from 'express'
import { HttpError } from '../../middleware/errors'
import { IMAGE_KINDS, type ImageKind } from './company.images'
import type { CompanyListQuery } from './company.schema'
import {
  getOwnCompany,
  getPublicCompany,
  getPublicImage,
  getPublicImageMeta,
  listCompanies,
  removeOwnImage,
  saveOwnCompany,
  setVerified,
  uploadOwnImage,
} from './company.service'

const kindOf = (value: unknown): ImageKind => {
  if (!IMAGE_KINDS.includes(value as ImageKind)) throw new HttpError(404, 'Not found')
  return value as ImageKind
}

export const list: RequestHandler = async (_req, res) => {
  res.json(await listCompanies(res.locals.query as CompanyListQuery))
}

export const getOne: RequestHandler = async (req, res) => {
  res.json(await getPublicCompany(String(req.params.id)))
}

export const getImageHandler: RequestHandler = async (req, res) => {
  const id = String(req.params.id)
  const kind = kindOf(req.params.kind)
  // Check the etag first (a tiny query) so a conditional request never reads the image bytes.
  const meta = await getPublicImageMeta(id, kind)
  // The URL carries the content hash (?v=), so a changed image gets a new URL and can be cached hard.
  // CORP is relaxed because helmet defaults to same-origin and the API may sit on another origin.
  res.set({
    'Content-Type': meta.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"${meta.etag}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
  if (req.headers['if-none-match'] === `"${meta.etag}"`) {
    res.status(304).end()
    return
  }
  const image = await getPublicImage(id, kind)
  res.send(Buffer.from(image.data))
}

export const getMine: RequestHandler = async (req, res) => {
  res.json({ company: await getOwnCompany(req.auth!.user) })
}

export const saveMine: RequestHandler = async (req, res) => {
  res.json({ company: await saveOwnCompany(req.auth!.user, req.body) })
}

export const uploadMine: RequestHandler = async (req, res) => {
  res.json({ company: await uploadOwnImage(req.auth!.user, kindOf(req.params.kind), req.body) })
}

export const removeMine: RequestHandler = async (req, res) => {
  res.json({ company: await removeOwnImage(req.auth!.user, kindOf(req.params.kind)) })
}

export const verify: RequestHandler = async (req, res) => {
  res.json(await setVerified(req.auth!.user.id, String(req.params.id), req.body.verified))
}
