import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import { termNamesFor } from '../catalog/catalog.service'
import type { JobInput } from '../jobs/jobs.schema'
import type { ProfileInput } from '../candidate-profile/candidate-profile.schema'
import { checkEligibility, matchEngine } from './matching.engine'
import type { EligibilityResult, MatchResult } from './matching.types'

// Recommendations score the newest active jobs in process (the engine is pure and cheap).
const RECOMMEND_POOL = 200

export type ScoredMatch = MatchResult & { eligibility: EligibilityResult }

/** The one place a profile and a job are turned into a score, shared by gap, recommendations and apply. */
export function scoreMatch(profile: ProfileInput, job: JobInput): ScoredMatch {
  return { ...matchEngine(profile, job), eligibility: checkEligibility(profile, job) }
}

/** The candidate's current profile version, or 409 when they have not built a resume yet. */
export async function loadCurrentProfile(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: { currentVersion: true },
  })
  if (!profile?.currentVersion) {
    throw new HttpError(409, 'Build your resume to see how you match')
  }
  return { versionId: profile.currentVersion.id, content: profile.currentVersion.content as ProfileInput }
}

/** Breakdown as stored on an application: ids only, so it stays valid whatever the catalog does later. */
export const toBreakdown = (m: ScoredMatch) => ({
  dimensions: m.dimensions,
  missing: m.missing,
  eligibility: m.eligibility,
})

export type Breakdown = ReturnType<typeof toBreakdown>

/** Adds display names to a stored breakdown. */
export async function nameBreakdown(b: Breakdown) {
  const names = await termNamesFor([...b.missing.skills.map((s) => s.termId), ...b.missing.certs])
  const name = (id: string) => names[id] ?? id
  return {
    dimensions: b.dimensions,
    eligibility: b.eligibility,
    missing: {
      skills: b.missing.skills.map((s) => ({ ...s, name: name(s.termId) })),
      certs: b.missing.certs.map((id) => ({ termId: id, name: name(id) })),
    },
  }
}

/** Live gap view: the current profile against the job's current requirements. */
export async function getGap(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, status: 'active' },
    include: { currentVersion: true },
  })
  if (!job?.currentVersion) throw new HttpError(404, 'Job not found')
  const profile = await loadCurrentProfile(userId)

  const match = scoreMatch(profile.content, job.currentVersion.content as JobInput)
  const application = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId, candidateId: userId } },
    select: { id: true, status: true, matchScore: true, createdAt: true },
  })

  return {
    jobId,
    jobVersionId: job.currentVersion.id,
    profileVersionId: profile.versionId,
    engineVersion: match.engineVersion,
    score: match.score,
    ...(await nameBreakdown(toBreakdown(match))),
    application,
  }
}

/** Active jobs the candidate has not applied to, best match first (id breaks ties for a stable order). */
export async function recommendJobs(userId: string, limit: number) {
  const profile = await loadCurrentProfile(userId)
  const jobs = await prisma.job.findMany({
    where: { status: 'active', applications: { none: { candidateId: userId } } },
    include: { currentVersion: true, employer: { select: { name: true } } },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: RECOMMEND_POOL,
  })

  const scored = jobs
    .flatMap((j) => (j.currentVersion ? [{ job: j, content: j.currentVersion.content as JobInput }] : []))
    .map(({ job, content }) => ({ job, content, match: scoreMatch(profile.content, content) }))
    .sort((a, b) => b.match.score - a.match.score || (a.job.id < b.job.id ? -1 : 1))
    .slice(0, limit)

  const termNames = await termNamesFor(scored.flatMap((s) => (s.content.domainId ? [s.content.domainId] : [])))
  return {
    jobs: scored.map(({ job, content, match }) => ({
      id: job.id,
      employerName: job.employer.name,
      title: content.title,
      location: content.location,
      workMode: content.workMode,
      salaryMin: content.salaryMin,
      salaryMax: content.salaryMax,
      domainId: content.domainId,
      score: match.score,
      eligibility: match.eligibility,
    })),
    termNames,
  }
}
