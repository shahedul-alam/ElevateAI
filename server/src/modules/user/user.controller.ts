import type { RequestHandler } from 'express'
import { prisma } from '../../config/db'
import { AI_CONSENT_VERSION, consentFor, hasCurrentConsent } from '../ai/ai-consent'

export const getMe: RequestHandler = async (req, res) => {
  const { id, email, name, role, emailVerified } = req.auth!.user
  res.json({ user: { id, email, name, role, emailVerified, aiConsent: hasCurrentConsent(await consentFor(id)) } })
}

export const postAiConsent: RequestHandler = async (req, res) => {
  await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { aiConsentAt: new Date(), aiConsentVersion: AI_CONSENT_VERSION },
  })
  res.json({ aiConsent: true })
}

export const deleteAiConsent: RequestHandler = async (req, res) => {
  await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { aiConsentAt: null, aiConsentVersion: null },
  })
  res.json({ aiConsent: false })
}
