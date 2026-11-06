import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { ApplicationStatus } from '../../../generated/prisma/client'
import { termNamesFor } from '../catalog/catalog.service'
import { companyRefSelect, toCompanyRef } from '../company/company.ref'
import { topSkills } from '../jobs/jobs.service'
import {
  parseStoredContact,
  parseStoredProfile,
  type ContactInput,
  type ProfileInput,
} from '../candidate-profile/candidate-profile.schema'
import { parseStoredJob } from '../jobs/jobs.schema'
import {
  loadCurrentProfile,
  nameBreakdown,
  scoreMatch,
  toBreakdown,
  type Breakdown,
} from '../matching/matching.service'
import type { ApplicantsQuery } from './applications.schema'

// Employers move an application forward only; hired and rejected are final.
const NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ['under_review', 'rejected'],
  under_review: ['rejected', 'hired'],
  rejected: [],
  hired: [],
}

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === 'P2002'

export async function applyToJob(candidateId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, status: { in: ['active', 'closed'] } },
    include: { currentVersion: true },
  })
  if (!job?.currentVersion) throw new HttpError(404, 'Job not found')
  if (job.status === 'closed') throw new HttpError(409, 'This job is closed')

  const profile = await loadCurrentProfile(candidateId)
  const existing = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId, candidateId } },
    select: { id: true },
  })
  if (existing) throw new HttpError(409, 'You have already applied to this job')

  // Frozen here: both versions and the result are stored, so later edits never move this score.
  const match = scoreMatch(profile.content, parseStoredJob(job.currentVersion.content))
  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          jobId,
          candidateId,
          profileVersionId: profile.versionId,
          jobVersionId: job.currentVersion!.id,
          matchScore: match.score,
          matchBreakdown: toBreakdown(match),
          engineVersion: match.engineVersion,
        },
      })
      await tx.applicationStatusHistory.create({
        data: { applicationId: application.id, toStatus: 'applied' },
      })
      return {
        id: application.id,
        status: application.status,
        matchScore: application.matchScore,
        createdAt: application.createdAt,
      }
    })
  } catch (err) {
    // Two simultaneous submits: the unique (job, candidate) constraint lets only one win.
    if (isUniqueViolation(err)) throw new HttpError(409, 'You have already applied to this job')
    throw err
  }
}

export async function listCandidateApplications(candidateId: string) {
  const rows = await prisma.application.findMany({
    where: { candidateId },
    include: {
      job: { select: { id: true, status: true, employer: { select: { name: true, company: { select: companyRefSelect } } } } },
      jobVersion: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  const cards = rows.map((a) => ({ a, content: parseStoredJob(a.jobVersion.content) }))
  const termNames = await termNamesFor(
    cards.flatMap(({ content }) => [...topSkills(content), ...(content.domainId ? [content.domainId] : [])]),
  )
  return {
    termNames,
    applications: cards.map(({ a, content }) => ({
      id: a.id,
      jobId: a.job.id,
      jobStatus: a.job.status,
      employerName: a.job.employer.company?.name ?? a.job.employer.name,
      company: a.job.employer.company ? toCompanyRef(a.job.employer.company) : null,
      title: content.title,
      location: content.location,
      workMode: content.workMode,
      employmentType: content.employmentType,
      salaryMin: content.salaryMin,
      salaryMax: content.salaryMax,
      domainId: content.domainId,
      skillIds: topSkills(content),
      status: a.status,
      matchScore: a.matchScore,
      engineVersion: a.engineVersion,
      createdAt: a.createdAt,
    })),
  }
}

/** Contact details as shown to an employer; empty fields and links are left out. */
function contactView(c: ContactInput) {
  const links = [
    { label: 'LinkedIn', url: c.linkedin },
    { label: 'GitHub', url: c.github },
    { label: 'Website', url: c.website },
    { label: 'Other', url: c.other },
  ].filter((l) => l.url)
  return { phone: c.phone, city: c.city, country: c.country, links }
}

/**
 * What an employer sees of the resume the candidate applied with. Preferences (location, work
 * mode, minimum salary) are the candidate's own and are left out.
 */
function resumeView(p: ProfileInput, names: Record<string, string>) {
  const name = (id: string) => names[id] ?? id
  return {
    headline: p.headline,
    summary: p.summary,
    leadershipLevel: p.leadershipLevel,
    skills: p.skills.map((s) => ({ name: name(s.termId), level: s.level, years: s.years })),
    roles: p.roles.map((r) => ({
      title: r.title,
      company: r.company,
      period: r.period,
      years: r.years,
      domain: r.domainId ? name(r.domainId) : undefined,
      description: r.description,
    })),
    education: p.education,
    certifications: p.certIds.map(name),
  }
}

/** Applicants for one of the employer's jobs, best score first (earlier applicant, then id, break ties). */
export async function listApplicants(employerId: string, jobId: string, query: ApplicantsQuery) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, employerId },
    select: { currentVersionId: true },
  })
  if (!job) throw new HttpError(404, 'Job not found')

  const rows = await prisma.application.findMany({
    where: { jobId },
    include: {
      candidate: {
        select: { name: true, email: true, candidateProfile: { select: { contact: true } } },
      },
      profileVersion: true,
    },
    orderBy: [{ matchScore: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  })
  const page = rows.slice(0, query.limit)

  const profiles = page.map((a) => parseStoredProfile(a.profileVersion.content))
  const names = await termNamesFor(
    profiles.flatMap((p) => [
      ...p.skills.map((s) => s.termId),
      ...p.roles.flatMap((r) => (r.domainId ? [r.domainId] : [])),
      ...p.certIds,
    ]),
  )

  // Live, not frozen: employers reach the candidate on their current details.
  const contacts = page.map((a) => parseStoredContact(a.candidate.candidateProfile?.contact))

  const applicants = await Promise.all(
    page.map(async (a, i) => {
      const profile = profiles[i]!
      return {
        id: a.id,
        candidateName: a.candidate.name,
        candidateEmail: contacts[i]!.email || a.candidate.email,
        contact: contactView(contacts[i]!),
        headline: profile.headline,
        totalYears: Math.round(profile.roles.reduce((sum, r) => sum + r.years, 0) * 100) / 100,
        status: a.status,
        matchScore: a.matchScore,
        engineVersion: a.engineVersion,
        // The job was edited after this candidate applied, so the score reflects its earlier requirements.
        scoredAgainstOlderVersion: a.jobVersionId !== job.currentVersionId,
        createdAt: a.createdAt,
        resume: resumeView(profile, names),
        breakdown: await nameBreakdown(a.matchBreakdown as Breakdown),
      }
    }),
  )
  return { applicants, nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null }
}

export async function changeApplicationStatus(employerId: string, id: string, to: ApplicationStatus) {
  const application = await prisma.application.findFirst({
    where: { id, job: { employerId } },
    select: { status: true },
  })
  if (!application) throw new HttpError(404, 'Application not found')
  if (!NEXT[application.status].includes(to)) {
    throw new HttpError(409, `Cannot move an application from ${application.status} to ${to}`)
  }

  return prisma.$transaction(async (tx) => {
    // The status guard keeps two simultaneous changes from both applying.
    const { count } = await tx.application.updateMany({
      where: { id, status: application.status },
      data: { status: to },
    })
    if (count === 0) throw new HttpError(409, 'This application was just updated. Reload and try again')
    await tx.applicationStatusHistory.create({
      data: { applicationId: id, fromStatus: application.status, toStatus: to },
    })
    return { id, status: to }
  })
}
