import type { RequestHandler } from 'express'
import { draftJob } from './job-assistant.service'

export const postDraft: RequestHandler = async (req, res) => {
  res.json(await draftJob(req.body.text))
}
