import type { RequestHandler } from 'express'
import type { JobListQuery } from './jobs.schema'
import {
  changeJobStatus,
  createJob,
  getEmployerJob,
  getPublicJob,
  listEmployerJobs,
  listPublicJobs,
  updateJob,
  type JobAction,
} from './jobs.service'

export const listJobs: RequestHandler = async (_req, res) => {
  res.json(await listPublicJobs(res.locals.query as JobListQuery))
}

export const getJob: RequestHandler = async (req, res) => {
  res.json({ job: await getPublicJob(String(req.params.id)) })
}

export const listMyJobs: RequestHandler = async (req, res) => {
  res.json({ jobs: await listEmployerJobs(req.auth!.user.id) })
}

export const createMyJob: RequestHandler = async (req, res) => {
  res.status(201).json({ job: await createJob(req.auth!.user.id, req.body) })
}

export const getMyJob: RequestHandler = async (req, res) => {
  res.json({ job: await getEmployerJob(req.auth!.user.id, String(req.params.id)) })
}

export const updateMyJob: RequestHandler = async (req, res) => {
  res.json({ job: await updateJob(req.auth!.user.id, String(req.params.id), req.body) })
}

export const changeMyJobStatus =
  (action: JobAction): RequestHandler =>
  async (req, res) => {
    res.json({ job: await changeJobStatus(req.auth!.user.id, String(req.params.id), action) })
  }
