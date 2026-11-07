import type { RequestHandler } from 'express'
import { evaluateResume, getEvaluation } from './resume-evaluator.service'

export const getMyEvaluation: RequestHandler = async (req, res) => {
  res.json(await getEvaluation(req.auth!.user.id))
}

export const postMyEvaluation: RequestHandler = async (req, res) => {
  res.json(await evaluateResume(req.auth!.user.id))
}
