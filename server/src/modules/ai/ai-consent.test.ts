import { expect, test } from 'bun:test'
import { AI_CONSENT_VERSION, hasCurrentConsent } from './ai-consent'

test('consent counts only when given for the current notice version', () => {
  const now = new Date()
  expect(hasCurrentConsent({ aiConsentAt: now, aiConsentVersion: AI_CONSENT_VERSION })).toBe(true)
  expect(hasCurrentConsent({ aiConsentAt: now, aiConsentVersion: AI_CONSENT_VERSION - 1 })).toBe(false)
  expect(hasCurrentConsent({ aiConsentAt: null, aiConsentVersion: null })).toBe(false)
  expect(hasCurrentConsent({ aiConsentAt: now, aiConsentVersion: null })).toBe(false)
  expect(hasCurrentConsent(null)).toBe(false)
})
