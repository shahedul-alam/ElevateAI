import type { RequestHandler } from 'express'
import type { RecommendQuery } from './matching.schema'
import { getGap, recommendJobs } from './matching.service'

export const getJobGap: RequestHandler = async (req, res) => {
  res.json(await getGap(req.auth!.user.id, String(req.params.id)))
}

export const getRecommendedJobs: RequestHandler = async (req, res) => {
  const { limit } = res.locals.query as RecommendQuery
  res.json(await recommendJobs(req.auth!.user.id, limit))
}
