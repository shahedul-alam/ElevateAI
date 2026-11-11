import type { RequestHandler } from 'express'
import { importResume } from './resume-import.service'

export const postImport: RequestHandler = async (req, res) => {
  res.json(await importResume(req.body))
}
