import type { RequestHandler } from 'express'
import { getPhotoInfo, removePhoto, savePhoto, sendCandidatePhoto } from './candidate-photo'
import { getProfile, listVersions, restoreVersion, saveProfile } from './candidate-profile.service'

export const getMyPhotoInfo: RequestHandler = async (req, res) => {
  res.json(await getPhotoInfo(req.auth!.user.id))
}

export const getMyPhoto: RequestHandler = async (req, res) => {
  await sendCandidatePhoto(req, res, req.auth!.user.id)
}

export const putMyPhoto: RequestHandler = async (req, res) => {
  res.json(await savePhoto(req.auth!.user.id, req.body))
}

export const deleteMyPhoto: RequestHandler = async (req, res) => {
  res.json(await removePhoto(req.auth!.user.id))
}

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
