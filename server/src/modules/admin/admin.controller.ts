import type { RequestHandler } from 'express'
import type { AdminJobsQuery, AdminUsersQuery } from './admin.schema'
import {
  getOverview,
  listJobs,
  listUsers,
  restoreUser,
  setJobSuspension,
  suspendUser,
} from './admin.service'

export const overview: RequestHandler = async (_req, res) => {
  res.json(await getOverview())
}

export const users: RequestHandler = async (_req, res) => {
  res.json(await listUsers(res.locals.query as AdminUsersQuery))
}

export const suspendOneUser: RequestHandler = async (req, res) => {
  res.json({ user: await suspendUser(req.auth!.user.id, String(req.params.id), req.body.reason) })
}

export const restoreOneUser: RequestHandler = async (req, res) => {
  res.json({ user: await restoreUser(String(req.params.id)) })
}

export const jobs: RequestHandler = async (_req, res) => {
  res.json(await listJobs(res.locals.query as AdminJobsQuery))
}

export const suspendOneJob: RequestHandler = async (req, res) => {
  res.json({ job: await setJobSuspension(String(req.params.id), req.body.reason) })
}

export const restoreOneJob: RequestHandler = async (req, res) => {
  res.json({ job: await setJobSuspension(String(req.params.id), null) })
}
