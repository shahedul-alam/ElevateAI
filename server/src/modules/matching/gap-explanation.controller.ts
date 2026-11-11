import type { RequestHandler } from 'express'
import { explainGap, getGapExplanation } from './gap-explanation.service'

export const getJobGapExplanation: RequestHandler = async (req, res) => {
  res.json(await getGapExplanation(req.auth!.user.id, String(req.params.id)))
}

export const postJobGapExplanation: RequestHandler = async (req, res) => {
  res.json(await explainGap(req.auth!.user.id, String(req.params.id)))
}
