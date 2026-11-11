import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { NotificationType, Prisma } from '../../../generated/prisma/client'
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
