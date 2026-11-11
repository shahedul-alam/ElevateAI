import type { RequestHandler } from 'express'
import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'

/** Bump when the privacy notice changes in a way users should agree to again. */
export const AI_CONSENT_VERSION = 1

type ConsentFields = { aiConsentAt: Date | null; aiConsentVersion: number | null }

/** Pure: true when the user agreed to the current version of the AI privacy notice. */
export const hasCurrentConsent = (u: ConsentFields | null | undefined) =>
  !!u?.aiConsentAt && u.aiConsentVersion === AI_CONSENT_VERSION

export const consentFor = (userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { aiConsentAt: true, aiConsentVersion: true } })

/**
 * Guards every route that sends a user's text to the model. The `aiConsent` detail is the stable
 * marker the client uses to open the consent dialog.
 */
export const requireAiConsent: RequestHandler = async (req, _res, next) => {
  if (!hasCurrentConsent(await consentFor(req.auth!.user.id))) {
    throw new HttpError(403, 'Please accept the AI privacy notice first', [
      { field: 'aiConsent', message: 'required' },
    ])
  }
  next()
}
