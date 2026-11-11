import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { NotificationType, Prisma } from '../../../generated/prisma/client'
import { retentionCutoffs } from './notifications.retention'
import type { NotificationsQuery } from './notifications.schema'

type Input = {
  userId: string
  type: NotificationType
  applicationId?: string
  title: string
  body: string
  /** An internal path such as `/applications`. */
  link: string
}

/** Takes the caller's transaction client, so the notification is written atomically with the event. */
export const createNotification = (tx: Prisma.TransactionClient, data: Input) => tx.notification.create({ data })

export const unreadCount = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } })

// shortcut: the cursor is a row id, so a delete or prune of that exact row between two page requests ends the scroll early; every delete refetches from the top, upgrade to a (createdAt, id) keyset if it shows up.
export async function listNotifications(userId: string, query: NotificationsQuery) {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    }),
    unreadCount(userId),
  ])
  return {
    notifications: rows.slice(0, query.limit),
    nextCursor: rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
    unreadCount: unread,
  }
}

export async function markRead(userId: string, id: string) {
  const owned = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owned) throw new HttpError(404, 'Notification not found')
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
}

export const markAllRead = (userId: string) =>
  prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })

/** Deleting is by (id, owner) in one query, so another user's id answers the same 404 as a missing one. */
export async function deleteNotification(userId: string, id: string) {
  const { count } = await prisma.notification.deleteMany({ where: { id, userId } })
  if (count === 0) throw new HttpError(404, 'Notification not found')
}

export const clearNotifications = (userId: string) => prisma.notification.deleteMany({ where: { userId } })

/** Expires read entries after 30 days and everything after 90. Idempotent, so any number of instances may run it. */
export async function pruneNotifications(now = new Date()) {
  const { readBefore, anyBefore } = retentionCutoffs(now)
  const { count } = await prisma.notification.deleteMany({
    where: { OR: [{ readAt: { not: null }, createdAt: { lt: readBefore } }, { createdAt: { lt: anyBefore } }] },
  })
  return count
}
