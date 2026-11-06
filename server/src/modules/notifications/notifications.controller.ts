import type { RequestHandler } from 'express'
import type { NotificationsQuery } from './notifications.schema'
import { listNotifications, markAllRead, markRead, unreadCount } from './notifications.service'

export const listMine: RequestHandler = async (req, res) => {
  res.json(await listNotifications(req.auth!.user.id, res.locals.query as NotificationsQuery))
}

export const countMine: RequestHandler = async (req, res) => {
  res.json({ unreadCount: await unreadCount(req.auth!.user.id) })
}

export const readOne: RequestHandler = async (req, res) => {
  await markRead(req.auth!.user.id, String(req.params.id))
  res.status(204).end()
}

export const readAll: RequestHandler = async (req, res) => {
  await markAllRead(req.auth!.user.id)
  res.status(204).end()
}
