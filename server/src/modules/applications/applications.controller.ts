import type { RequestHandler } from 'express'
import type { ApplicantsQuery, ChangeStatusInput } from './applications.schema'
import {
  applyToJob,
  changeApplicationStatus,
  listApplicants,
  listCandidateApplications,
} from './applications.service'

export const applyToJobHandler: RequestHandler = async (req, res) => {
  res.status(201).json({ application: await applyToJob(req.auth!.user.id, String(req.params.id)) })
}

export const listMyApplications: RequestHandler = async (req, res) => {
  res.json(await listCandidateApplications(req.auth!.user.id))
}

export const listJobApplicants: RequestHandler = async (req, res) => {
  const query = res.locals.query as ApplicantsQuery
  res.json(await listApplicants(req.auth!.user.id, String(req.params.id), query))
}

export const changeStatusHandler: RequestHandler = async (req, res) => {
  const { status } = req.body as ChangeStatusInput
  res.json({ application: await changeApplicationStatus(req.auth!.user.id, String(req.params.id), status) })
}
