import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { ApplicationStatus, Prisma } from '../../../generated/prisma/client'
import { createNotification } from '../notifications/notifications.service'
import { receivedMessage, statusMessage } from '../notifications/notifications.messages'
import { termNamesFor } from '../catalog/catalog.service'
import { applicationPhotoUrl } from '../candidate-profile/candidate-photo'
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
import { ensureSummaries, ensureSummary } from './applicant-summary.service'
import { PIPELINE, type ApplicantsQuery, type EmployerApplicationsQuery } from './applications.schema'

type ApplicantRow = Prisma.ApplicationGetPayload<{ include: typeof applicantInclude }>

// Employers move an application forward only (a stage may be skipped) or reject it; hired and rejected are final.
const NEXT = Object.fromEntries([
  ...PIPELINE.map((s, i) => [s, s === 'hired' ? [] : [...PIPELINE.slice(i + 1), 'rejected']]),
  ['rejected', []],
]) as Record<ApplicationStatus, ApplicationStatus[]>

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === 'P2002'

export async function applyToJob(candidateId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, status: { in: ['active', 'closed'] } },
    include: { currentVersion: true },
  })
  if (!job?.currentVersion) throw new HttpError(404, 'Job not found')
  if (job.status === 'closed') throw new HttpError(409, 'This job is closed')

  const profile = await loadCurrentProfile(candidateId)
  const candidate = await prisma.user.findUnique({ where: { id: candidateId }, select: { name: true } })
  // Frozen with the application: later photo changes do not reach employers who already have it.
  const photo = await prisma.candidateProfile.findUnique({ where: { userId: candidateId }, select: { photoId: true } })
  const existing = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId, candidateId } },
    select: { id: true },
  })
  if (existing) throw new HttpError(409, 'You have already applied to this job')

  // Frozen here: both versions and the result are stored, so later edits never move this score.
  const match = scoreMatch(profile.content, parseStoredJob(job.currentVersion.content))
  try {
    const created = await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          jobId,
          candidateId,
          profileVersionId: profile.versionId,
          jobVersionId: job.currentVersion!.id,
          photoId: photo?.photoId ?? null,
          matchScore: match.score,
          matchBreakdown: toBreakdown(match),
          engineVersion: match.engineVersion,
        },
      })
      await tx.applicationStatusHistory.create({
        data: { applicationId: application.id, toStatus: 'applied' },
      })
      await createNotification(tx, {
        userId: job.employerId,
        type: 'application_received',
        applicationId: application.id,
        ...receivedMessage(candidate?.name ?? 'A candidate', parseStoredJob(job.currentVersion!.content).title, match.score),
        link: `/employer/hiring?job=${jobId}`,
      })
      return {
        id: application.id,
        status: application.status,
        matchScore: application.matchScore,
        createdAt: application.createdAt,
      }
    })
    // After the commit and not awaited: the model call can never slow down or fail an application.
    void ensureSummary(created.id)
    return created
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

// Shared by both employer lists, so a per-job card and a company-wide card cannot drift.
const applicantInclude = {
  candidate: { select: { name: true, email: true, candidateProfile: { select: { contact: true } } } },
  profileVersion: true,
  jobVersion: { select: { content: true } },
  job: { select: { currentVersionId: true } },
  _count: { select: { notes: true } },
} as const

const applicantOrder = [{ matchScore: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] as const

async function presentApplicants(page: ApplicantRow[]) {
  const profiles = page.map((a) => parseStoredProfile(a.profileVersion.content))
  const names = await termNamesFor(
    profiles.flatMap((p) => [
      ...p.skills.map((s) => s.termId),
      ...p.roles.flatMap((r) => (r.domainId ? [r.domainId] : [])),
      ...p.certIds,
    ]),
  )

  // Fills missing summaries in the background; they show up on the next refetch.
  ensureSummaries(page.filter((a) => a.summary === null).map((a) => a.id))

  // Live, not frozen: employers reach the candidate on their current details.
  const contacts = page.map((a) => parseStoredContact(a.candidate.candidateProfile?.contact))

  return Promise.all(
    page.map(async (a, i) => {
      const profile = profiles[i]!
      return {
        id: a.id,
        jobId: a.jobId,
        jobTitle: parseStoredJob(a.jobVersion.content).title,
        rating: a.rating,
        noteCount: a._count.notes,
        photoUrl: applicationPhotoUrl(a.id, a.photoId),
        candidateName: a.candidate.name,
        candidateEmail: contacts[i]!.email || a.candidate.email,
        contact: contactView(contacts[i]!),
        headline: profile.headline,
        // AI description of the frozen resume; employer-only, null until generated.
        summary: a.summary,
        totalYears: Math.round(profile.roles.reduce((sum, r) => sum + r.years, 0) * 100) / 100,
        status: a.status,
        matchScore: a.matchScore,
        engineVersion: a.engineVersion,
        // The job was edited after this candidate applied, so the score reflects its earlier requirements.
        scoredAgainstOlderVersion: a.jobVersionId !== a.job.currentVersionId,
        createdAt: a.createdAt,
        resume: resumeView(profile, names),
        breakdown: await nameBreakdown(a.matchBreakdown as Breakdown),
      }
    }),
  )
}

const nextCursor = (rows: { id: string }[], limit: number) =>
  rows.length > limit ? (rows[limit - 1]?.id ?? null) : null

/** Applicants for one of the employer's jobs, best score first (earlier applicant, then id, break ties). */
export async function listApplicants(employerId: string, jobId: string, query: ApplicantsQuery) {
  const job = await prisma.job.findFirst({ where: { id: jobId, employerId }, select: { id: true } })
  if (!job) throw new HttpError(404, 'Job not found')

  const rows = await prisma.application.findMany({
    where: { jobId },
    include: applicantInclude,
    orderBy: [...applicantOrder],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  })
  return {
    applicants: await presentApplicants(rows.slice(0, query.limit)),
    nextCursor: nextCursor(rows, query.limit),
  }
}

/** Applicants across all of the employer's jobs, with per-status counts for the current filters. */
export async function listEmployerApplications(employerId: string, query: EmployerApplicationsQuery) {
  const base: Prisma.ApplicationWhereInput = {
    job: { employerId, ...(query.jobId && { id: query.jobId }) },
    ...(query.q && { candidate: { name: { contains: query.q, mode: 'insensitive' } } }),
    ...(query.minRating && { rating: { gte: query.minRating } }),
  }
  const [rows, grouped] = await Promise.all([
    prisma.application.findMany({
      where: { ...base, ...(query.status && { status: query.status }) },
      include: applicantInclude,
      orderBy: [...applicantOrder],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    }),
    prisma.application.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
  ])
  const counts = Object.fromEntries([...PIPELINE, 'rejected'].map((s) => [s, 0])) as Record<ApplicationStatus, number>
  for (const g of grouped) counts[g.status] = g._count._all
  return {
    applicants: await presentApplicants(rows.slice(0, query.limit)),
    nextCursor: nextCursor(rows, query.limit),
    counts,
  }
}

/** Ownership check shared by the activity, note and rating endpoints. */
async function ownedApplication(employerId: string, id: string) {
  const application = await prisma.application.findFirst({ where: { id, job: { employerId } }, select: { id: true } })
  if (!application) throw new HttpError(404, 'Application not found')
}

export async function getActivity(employerId: string, id: string) {
  await ownedApplication(employerId, id)
  const [history, notes] = await Promise.all([
    prisma.applicationStatusHistory.findMany({
      where: { applicationId: id },
      select: { fromStatus: true, toStatus: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.applicationNote.findMany({
      where: { applicationId: id },
      select: { id: true, body: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
  ])
  return { history, notes }
}

export async function addNote(employerId: string, id: string, body: string) {
  await ownedApplication(employerId, id)
  return prisma.applicationNote.create({
    data: { applicationId: id, body },
    select: { id: true, body: true, createdAt: true },
  })
}

export async function deleteNote(employerId: string, id: string, noteId: string) {
  await ownedApplication(employerId, id)
  const { count } = await prisma.applicationNote.deleteMany({ where: { id: noteId, applicationId: id } })
  if (count === 0) throw new HttpError(404, 'Note not found')
}

export async function setRating(employerId: string, id: string, rating: number | null) {
  await ownedApplication(employerId, id)
  await prisma.application.update({ where: { id }, data: { rating } })
  return { id, rating }
}

export async function changeApplicationStatus(employerId: string, id: string, to: ApplicationStatus) {
  const application = await prisma.application.findFirst({
    where: { id, job: { employerId } },
    select: {
      status: true,
      candidateId: true,
      jobVersion: { select: { content: true } },
      job: { select: { employer: { select: { name: true, company: { select: { name: true } } } } } },
    },
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
    // Same transaction as the move, and the status guard above means once per real change.
    const employer = application.job.employer
    await createNotification(tx, {
      userId: application.candidateId,
      type: 'application_status',
      applicationId: id,
      ...statusMessage(to, parseStoredJob(application.jobVersion.content).title, employer.company?.name ?? employer.name),
      link: '/applications',
    })
    return { id, status: to }
  })
}
