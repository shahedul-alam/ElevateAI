import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { Prisma } from '../../../generated/prisma/client'
import { parseStoredJob } from '../jobs/jobs.schema'
import { createNotification } from '../notifications/notifications.service'
import { moderationMessage } from '../notifications/notifications.messages'
import type { AdminJobsQuery, AdminUsersQuery } from './admin.schema'

export async function getOverview() {
  const [roles, suspendedUsers, jobs, suspendedJobs, unverifiedCompanies] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.job.count({ where: { suspendedAt: { not: null } } }),
    prisma.company.count({ where: { verified: false } }),
  ])
  return {
    users: Object.fromEntries(roles.map((r) => [r.role, r._count._all])) as Record<string, number>,
    suspendedUsers,
    jobs: Object.fromEntries(jobs.map((j) => [j.status, j._count._all])) as Record<string, number>,
    suspendedJobs,
    unverifiedCompanies,
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  suspendedAt: true,
  suspendedReason: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export async function listUsers(query: AdminUsersQuery) {
  const rows = await prisma.user.findMany({
    where: {
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
      ...(query.role && { role: query.role }),
      ...(query.suspended !== undefined && { suspendedAt: query.suspended ? { not: null } : null }),
    },
    select: userSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  })
  return {
    users: rows.slice(0, query.limit),
    nextCursor: rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
  }
}

/** Suspends a non-admin user and ends all their sessions in one transaction. */
export async function suspendUser(adminId: string, id: string, reason: string) {
  if (id === adminId) throw new HttpError(409, 'You cannot suspend yourself')
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) throw new HttpError(404, 'User not found')
  if (target.role === 'admin') throw new HttpError(409, 'Admins cannot be suspended')
  return prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: id } })
    return tx.user.update({
      where: { id },
      data: { suspendedAt: new Date(), suspendedReason: reason },
      select: userSelect,
    })
  })
}

export async function restoreUser(id: string) {
  const { count } = await prisma.user.updateMany({
    where: { id },
    data: { suspendedAt: null, suspendedReason: null },
  })
  if (count === 0) throw new HttpError(404, 'User not found')
  return prisma.user.findUniqueOrThrow({ where: { id }, select: userSelect })
}

const jobInclude = {
  currentVersion: true,
  employer: { select: { id: true, name: true, email: true, suspendedAt: true, company: { select: { id: true, name: true } } } },
} satisfies Prisma.JobInclude

type JobWithRelations = Prisma.JobGetPayload<{ include: typeof jobInclude }>

const toAdminJob = (j: JobWithRelations) => ({
  id: j.id,
  title: j.currentVersion ? parseStoredJob(j.currentVersion.content).title : '',
  status: j.status,
  publishedAt: j.publishedAt,
  suspendedAt: j.suspendedAt,
  suspendedReason: j.suspendedReason,
  employer: {
    id: j.employer.id,
    name: j.employer.name,
    email: j.employer.email,
    suspended: j.employer.suspendedAt !== null,
  },
  company: j.employer.company,
})

export async function listJobs(query: AdminJobsQuery) {
  const rows = await prisma.job.findMany({
    where: {
      ...(query.status && { status: query.status }),
      ...(query.suspended !== undefined && { suspendedAt: query.suspended ? { not: null } : null }),
      ...(query.q && {
        currentVersion: { content: { path: ['title'], string_contains: query.q, mode: 'insensitive' } },
      }),
    },
    include: jobInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  })
  return {
    jobs: rows.slice(0, query.limit).map(toAdminJob),
    nextCursor: rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
  }
}

/** Suspends or restores a job and tells the employer, atomically with the change. */
export async function setJobSuspension(id: string, reason: string | null) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude })
  if (!job) throw new HttpError(404, 'Job not found')
  const suspending = reason !== null
  if (suspending === (job.suspendedAt !== null)) {
    throw new HttpError(409, suspending ? 'Job is already suspended' : 'Job is not suspended')
  }
  const title = job.currentVersion ? parseStoredJob(job.currentVersion.content).title : 'your job'
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.job.update({
      where: { id },
      data: suspending ? { suspendedAt: new Date(), suspendedReason: reason } : { suspendedAt: null, suspendedReason: null },
      include: jobInclude,
    })
    await createNotification(tx, {
      userId: job.employerId,
      type: 'moderation',
      link: '/employer/jobs',
      ...moderationMessage(suspending ? 'suspended' : 'restored', title, reason),
    })
    return row
  })
  return toAdminJob(updated)
}
