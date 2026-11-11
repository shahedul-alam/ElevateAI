/** The slice of a company that job cards and job pages embed (no image bytes: only their version). */
export const companyRefSelect = {
  id: true,
  name: true,
  tagline: true,
  verified: true,
  images: { select: { kind: true, etag: true } },
} as const

type RefRow = {
  id: string
  name: string
  tagline: string
  verified: boolean
  images: { kind: string; etag: string }[]
}

export const imageUrl = (companyId: string, kind: 'logo' | 'cover', images: { kind: string; etag: string }[]) => {
  const image = images.find((i) => i.kind === kind)
  return image ? `/api/companies/${companyId}/${kind}?v=${image.etag}` : null
}

export const toCompanyRef = (c: RefRow) => ({
  id: c.id,
  name: c.name,
  tagline: c.tagline,
  verified: c.verified,
  logoUrl: imageUrl(c.id, 'logo', c.images),
})
