import { prisma } from '../../config/db'
import type { Prisma } from '../../../generated/prisma/client'
import type { AdminAuditQuery } from './admin.schema'

export const AUDIT_ACTIONS = [
  'user.suspend',
  'user.restore',
  'user.delete',
  'job.suspend',
  'job.restore',
  'company.verify',
  'company.unverify',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

type Db = Prisma.TransactionClient

/** Writes one audit row; call it inside the transaction that makes the change. */
export async function recordAudit(
  db: Db,
  adminId: string,
  entry: { action: AuditAction; targetId: string; targetLabel: string; reason?: string | null },
) {
  const actor = await db.user.findUniqueOrThrow({ where: { id: adminId }, select: { email: true } })
  await db.adminAuditLog.create({
    data: {
      actorId: adminId,
      actorEmail: actor.email,
      action: entry.action,
      targetType: entry.action.split('.')[0]!,
      targetId: entry.targetId,
      targetLabel: entry.targetLabel,
      reason: entry.reason ?? null,
    },
  })
}

export async function listAudit(query: AdminAuditQuery) {
  const rows = await prisma.adminAuditLog.findMany({
    where: {
      ...(query.action && { action: query.action }),
      ...(query.q && {
        OR: [
          { targetLabel: { contains: query.q, mode: 'insensitive' } },
          { actorEmail: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  })
  return {
    entries: rows.slice(0, query.limit),
    nextCursor: rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
  }
}
