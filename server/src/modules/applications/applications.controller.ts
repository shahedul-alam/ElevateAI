import type { RequestHandler } from 'express'
import { sendApplicationPhoto } from '../candidate-profile/candidate-photo'
import type { ApplicantsQuery, ChangeStatusInput, EmployerApplicationsQuery } from './applications.schema'
import {
  addNote,
  applyToJob,
  changeApplicationStatus,
  deleteNote,
  getActivity,
  listApplicants,
  listCandidateApplications,
  listEmployerApplications,
  setRating,
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

export const listAllApplications: RequestHandler = async (req, res) => {
  res.json(await listEmployerApplications(req.auth!.user.id, res.locals.query as EmployerApplicationsQuery))
}

export const photoHandler: RequestHandler = async (req, res) => {
  await sendApplicationPhoto(req, res, req.auth!.user.id, String(req.params.id))
}

export const activityHandler: RequestHandler = async (req, res) => {
  res.json(await getActivity(req.auth!.user.id, String(req.params.id)))
}

export const addNoteHandler: RequestHandler = async (req, res) => {
  const { body } = req.body as { body: string }
  res.status(201).json({ note: await addNote(req.auth!.user.id, String(req.params.id), body) })
}

export const deleteNoteHandler: RequestHandler = async (req, res) => {
  await deleteNote(req.auth!.user.id, String(req.params.id), String(req.params.noteId))
  res.status(204).end()
}

export const ratingHandler: RequestHandler = async (req, res) => {
  const { rating } = req.body as { rating: number | null }
  res.json(await setRating(req.auth!.user.id, String(req.params.id), rating))
}

export const changeStatusHandler: RequestHandler = async (req, res) => {
  const { status } = req.body as ChangeStatusInput
  res.json({ application: await changeApplicationStatus(req.auth!.user.id, String(req.params.id), status) })
}
