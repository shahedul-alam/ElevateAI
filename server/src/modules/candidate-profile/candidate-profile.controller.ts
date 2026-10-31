import type { RequestHandler } from 'express'
import { getProfile, listVersions, restoreVersion, saveProfile } from './candidate-profile.service'

export const getMyProfile: RequestHandler = async (req, res) => {
  res.json({ profile: await getProfile(req.auth!.user.id) })
}

export const putMyProfile: RequestHandler = async (req, res) => {
  res.json({ profile: await saveProfile(req.auth!.user.id, req.body) })
}

export const getMyVersions: RequestHandler = async (req, res) => {
  res.json(await listVersions(req.auth!.user.id))
}

export const restoreMyVersion: RequestHandler = async (req, res) => {
  res.json({ profile: await restoreVersion(req.auth!.user.id, String(req.params.id)) })
}
