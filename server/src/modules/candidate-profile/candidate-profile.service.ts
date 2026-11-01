import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import { hashContent } from '../../lib/content-hash'
import { assertApprovedTerms, termNamesFor } from '../catalog/catalog.service'
import { canonicalizeProfile } from './candidate-profile.canonical'
import {
  parseStoredContact,
  parseStoredProfile,
  type ProfileInput,
  type ProfileSaveInput,
} from './candidate-profile.schema'

type VersionRow = { id: string; createdAt: Date; content: unknown }

const toDto = (v: VersionRow, currentId: string | null) => ({
  id: v.id,
  createdAt: v.createdAt,
  isCurrent: v.id === currentId,
  content: parseStoredProfile(v.content),
})

async function assertCatalogTerms(input: ProfileInput) {
  const wanted = new Map<string, string>()
  input.skills.forEach((s, i) => wanted.set(s.termId, `skills.${i}.termId`))
  input.roles.forEach((r, i) => r.domainId && wanted.set(r.domainId, `roles.${i}.domainId`))
  input.certIds.forEach((c, i) => wanted.set(c, `certIds.${i}`))
  await assertApprovedTerms(wanted)
}

/** id -> display name for every catalog term the given contents reference. */
function termNames(contents: ProfileInput[]) {
  const ids = new Set<string>()
  for (const c of contents) {
    c.skills.forEach((s) => ids.add(s.termId))
    c.roles.forEach((r) => r.domainId && ids.add(r.domainId))
    c.certIds.forEach((id) => ids.add(id))
  }
  return termNamesFor(ids)
}

export async function getProfile(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: { currentVersion: true },
  })
  if (!profile?.currentVersion) return null
  const dto = toDto(profile.currentVersion, profile.currentVersionId)
  return {
    ...dto,
    termNames: await termNames([dto.content]),
    contact: parseStoredContact(profile.contact),
  }
}

/** Saving content that already exists as a version reuses that row (and makes it current). */
export async function saveProfile(userId: string, input: ProfileSaveInput) {
  // Contact lives outside the versioned content, so it never changes the hash or creates a version.
  const { contact, ...resume } = input
  await assertCatalogTerms(resume)
  const content = canonicalizeProfile(resume)
  const contentHash = hashContent(content)

  return prisma.$transaction(async (tx) => {
    const profile = await tx.candidateProfile.upsert({
      where: { userId },
      update: contact ? { contact } : {},
      create: { userId, ...(contact && { contact }) },
    })
    const version = await tx.profileVersion.upsert({
      where: { profileId_contentHash: { profileId: profile.id, contentHash } },
      update: {},
      create: { profileId: profile.id, contentHash, content },
    })
    await tx.candidateProfile.update({
      where: { id: profile.id },
      data: { currentVersionId: version.id },
    })
    return toDto(version, version.id)
  })
}

export async function listVersions(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: { versions: { orderBy: { createdAt: 'desc' }, take: 50 } },
  })
  if (!profile) return { versions: [], termNames: {} }
  const versions = profile.versions.map((v) => toDto(v, profile.currentVersionId))
  return { versions, termNames: await termNames(versions.map((v) => v.content)) }
}

/** Restore repoints to the old row: no new version, so the restored state scores exactly as before. */
export async function restoreVersion(userId: string, versionId: string) {
  const version = await prisma.profileVersion.findFirst({
    where: { id: versionId, profile: { userId } },
  })
  if (!version) throw new HttpError(404, 'Version not found')
  await prisma.candidateProfile.update({
    where: { userId },
    data: { currentVersionId: version.id },
  })
  return toDto(version, version.id)
}
