import { expect, test } from '@playwright/test'
import { grantAiConsent, registerUser } from './support/auth'
import { profileContent, saveProfileApi, saveResume } from './support/profile'

// AI_STUB is on: every evaluation is the canned one (overall 71).
const PATH = '/api/candidate/profile/evaluation'
const SCORES = { skills: 80, impact: 60, structure: 70, clarity: 90, completeness: 50 }

test.describe('resume evaluation API with the stubbed model', () => {
  test('POST returns the canned evaluation, repeats are free and GET returns the stored one', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    await saveProfileApi(request, profileContent())

    const first = await request.post(PATH)
    expect(first.status(), await first.text()).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.evaluation).toMatchObject({
      overall: 71,
      scores: SCORES,
      keywords: ['Docker', 'CI/CD'],
    })
    expect(firstBody.evaluation.strengths).toHaveLength(2)
    expect(firstBody.evaluation.weaknesses).toHaveLength(2)
    expect(firstBody.remainingToday).toBe(4)

    const second = await request.post(PATH)
    expect(second.status()).toBe(200)
    expect(await second.json()).toEqual(firstBody)

    const got = await request.get(PATH)
    expect(await got.json()).toEqual(firstBody)
  })

  test('a changed resume has no evaluation until it is reviewed', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)
    await saveProfileApi(request, profileContent({ headline: 'First' }))
    expect((await request.post(PATH)).status()).toBe(200)

    await saveProfileApi(request, profileContent({ headline: 'Second' }))
    expect(await (await request.get(PATH)).json()).toEqual({ evaluation: null, remainingToday: 4 })
  })

  test('answers 429 on the sixth new evaluation of the day', async ({ request }) => {
    await registerUser(request)
    await grantAiConsent(request)

    for (let n = 1; n <= 5; n++) {
      await saveProfileApi(request, profileContent({ headline: `Variant ${n}` }))
      const res = await request.post(PATH)
      expect(res.status(), await res.text()).toBe(200)
      expect((await res.json()).remainingToday).toBe(5 - n)
    }

    await saveProfileApi(request, profileContent({ headline: 'Variant 6' }))
    const limited = await request.post(PATH)
    expect(limited.status()).toBe(429)
    expect((await limited.json()).error.message).toContain('all of your resume evaluations for today')
  })
})

test.describe('resume review card with the stubbed model', () => {
  test('asks for consent, shows the scores, then locks until the resume changes', async ({ page }) => {
    await registerUser(page.request)
    await saveProfileApi(page.request, profileContent({ headline: 'Before review' }))
    await page.goto('/resume')

    await expect(page.getByText('This version of your resume has not been reviewed yet.')).toBeVisible()
    const button = page.getByRole('button', { name: 'Review my resume' })
    await expect(button).toBeEnabled()
    await button.click()

    const consent = page.getByRole('alertdialog')
    await expect(consent.getByText('Use AI features?')).toBeVisible()
    await consent.getByRole('button', { name: 'Agree and continue' }).click()

    await expect(page.getByText('71 / 100')).toBeVisible()
    for (const [label, key] of [
      ['Skills relevance', 'skills'],
      ['Impact', 'impact'],
      ['Structure', 'structure'],
      ['Clarity', 'clarity'],
      ['Completeness', 'completeness'],
    ] as const) {
      await expect(page.getByRole('progressbar', { name: label })).toHaveAttribute('aria-valuenow', String(SCORES[key]))
    }
    await expect(page.getByText('Clear, focused headline.')).toBeVisible()
    await expect(page.getByText('The summary is short.')).toBeVisible()
    await expect(page.getByText('Docker', { exact: true })).toBeVisible()
    await expect(button).toBeDisabled()
    await expect(page.getByText('Edit and save your resume to get a new review.')).toBeVisible()

    // Saving a different resume resets the card.
    await page.getByLabel('Short professional headline').fill('After review')
    await saveResume(page)
    await expect(page.getByText('This version of your resume has not been reviewed yet.')).toBeVisible()
    await expect(page.getByText('71 / 100')).toHaveCount(0)
    await expect(button).toBeEnabled()
  })

  test('shows a stored review on load without asking again', async ({ page }) => {
    await registerUser(page.request)
    await grantAiConsent(page.request)
    await saveProfileApi(page.request, profileContent())
    expect((await page.request.post(PATH)).status()).toBe(200)

    await page.goto('/resume')
    await expect(page.getByText('71 / 100')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review my resume' })).toBeDisabled()
  })
})
