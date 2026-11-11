import { Router } from 'express'
import { requireUuidParam, validateQuery } from '../../middleware/validate'
import { requireAuth } from '../auth/auth.middleware'
import { countMine, listMine, readAll, readOne, removeAll, removeOne } from './notifications.controller'
import { notificationsQuerySchema } from './notifications.schema'

export const notificationsRouter = Router()

// Any signed-in role; every handler is scoped to the caller's own id.
notificationsRouter.use('/notifications', requireAuth)
notificationsRouter.get('/notifications', validateQuery(notificationsQuerySchema), listMine)
notificationsRouter.get('/notifications/unread-count', countMine)
notificationsRouter.post('/notifications/read-all', readAll)
notificationsRouter.post('/notifications/:id/read', requireUuidParam(), readOne)
notificationsRouter.delete('/notifications', removeAll)
notificationsRouter.delete('/notifications/:id', requireUuidParam(), removeOne)
