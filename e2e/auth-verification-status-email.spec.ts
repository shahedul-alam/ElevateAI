import { expect, test, type APIRequestContext, type Playwright } from '@playwright/test'
import { linkIn, mailsTo, waitForMail } from './support/mail'
import { listNotifications } from './support/notifications'
import { publishReactJob, applyApi, setStatus, PROFILE_A } from './support/matching'
import { saveProfileApi } from './support/profile'
import { uniqueTitle } from './support/jobs'
import { signedInVerifiedUser, signUpPending, ORIGIN } from './support/verification'
import type { Role } from './support/auth'

// File name matches the "verification" project: its stack has a server whose SMTP_URL points at the mail sink.

/** A verified, signed-in API context on the verification stack (the verification link signs the context in). */
async function verifiedContext(playwright: Playwright, baseURL: string | undefined, role: Role) {
  const ctx = await playwright.request.newContext({ baseURL })
  const user = await signUpPending(ctx, { role })
  const verify = await ctx.get(linkIn(await waitForMail(user.email, 'Verify your ElevateAI email')), { maxRedirects: 0 })
  expect(verify.status()).toBe(302)
  return { ctx, user }
}

const setEmails = (request: APIRequestContext, enabled: unknown) =>
  request.put('/api/me/email-notifications', { data: { enabled }, headers: ORIGIN })

/** A candidate with an application to a fresh job, plus the employer who owns it. */
async function setup(playwright: Playwright, baseURL: string | undefined) {
  const employer = await verifiedContext(playwright, baseURL, 'employer')
  const candidate = await verifiedContext(playwright, baseURL, 'candidate')
  const title = uniqueTitle('Status Mail Job')
  const job = await publishReactJob(employer.ctx, 3, { title })
  await saveProfileApi(candidate.ctx, PROFILE_A)
  const application = await applyApi(candidate.ctx, job.id)
  const move = (status: string) => setStatus(employer.ctx, application.id, status)
  return { employer, candidate, title, move }
}

test.describe('status change emails', () => {
  test('moving to a stage mails the candidate once with the stage title, job title and a link', async ({ playwright, baseURL }) => {
    const { candidate, title, move } = await setup(playwright, baseURL)
    expect((await move('under_review')).status()).toBe(200)

    const mail = await waitForMail(candidate.user.email, `Under review: ${title}`)
    expect(mail.text).toContain(title)
    expect(linkIn(mail)).toMatch(/\/applications$/)
    const sent = (await mailsTo(candidate.user.email)).filter((m) => m.subject === mail.subject)
    expect(sent).toHaveLength(1)
  })

  test('rejection uses the neutral wording and never says rejected', async ({ playwright, baseURL }) => {
    const { candidate, title, move } = await setup(playwright, baseURL)
    expect((await move('rejected')).status()).toBe(200)

    const mail = await waitForMail(candidate.user.email, `Update on your application for ${title}`)
    expect(mail.subject).not.toMatch(/rejected/i)
    expect(mail.text).toContain('will not be taking your application')
    expect(mail.text).not.toMatch(/rejected/i)
  })

  test('an invalid move (409) sends no mail', async ({ playwright, baseURL }) => {
    const { candidate, title, move } = await setup(playwright, baseURL)
    expect((await move('under_review')).status()).toBe(200)
    await waitForMail(candidate.user.email, `Under review: ${title}`)

    expect((await move('technical_interview')).status()).toBe(200)
    await waitForMail(candidate.user.email, `Technical interview: ${title}`)

    // A backward move is a real 409 (stages only go forward); it must not mail.
    expect((await move('under_review')).status()).toBe(409)
    expect((await move('offer')).status()).toBe(200)
    await waitForMail(candidate.user.email, `Offer: ${title}`)

    // Mails go out in order, so a mail for the 409 would sit before "Offer"; only the three real moves were mailed.
    const subjects = (await mailsTo(candidate.user.email)).map((m) => m.subject)
    expect(subjects.filter((s) => s.includes(title))).toEqual([
      `Under review: ${title}`,
      `Technical interview: ${title}`,
      `Offer: ${title}`,
    ])
  })

  test('opting out stops the mail but keeps the in-app notification; opting back in resumes it', async ({ playwright, baseURL }) => {
    const { candidate, title, move } = await setup(playwright, baseURL)
    expect((await setEmails(candidate.ctx, false)).status()).toBe(200)

    expect((await move('under_review')).status()).toBe(200)
    const { notifications } = await listNotifications(candidate.ctx)
    expect(notifications.some((n) => n.type === 'application_status' && n.title === `Under review: ${title}`)).toBe(true)

    expect((await setEmails(candidate.ctx, true)).status()).toBe(200)
    expect((await move('technical_interview')).status()).toBe(200)
    await waitForMail(candidate.user.email, `Technical interview: ${title}`)

    // The later mail is here, so the skipped one would be too if it had been sent.
    const subjects = (await mailsTo(candidate.user.email)).map((m) => m.subject)
    expect(subjects).not.toContain(`Under review: ${title}`)
  })
})

test.describe('email notifications setting', () => {
  test('rejects anonymous callers and invalid bodies', async ({ playwright, baseURL, request }) => {
    expect((await setEmails(request, true)).status()).toBe(401)

    const { ctx } = await verifiedContext(playwright, baseURL, 'candidate')
    expect((await ctx.put('/api/me/email-notifications', { data: {}, headers: ORIGIN })).status()).toBe(400)
    expect((await setEmails(ctx, 'yes')).status()).toBe(400)
  })

  test('/api/me reflects the setting', async ({ playwright, baseURL }) => {
    const { ctx } = await verifiedContext(playwright, baseURL, 'candidate')
    expect((await (await ctx.get('/api/me')).json()).user.emailNotifications).toBe(true)

    const res = await setEmails(ctx, false)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ emailNotifications: false })
    expect((await (await ctx.get('/api/me')).json()).user.emailNotifications).toBe(false)
  })

  test('a candidate turns status emails off on /account and it persists', async ({ page }) => {
    await signedInVerifiedUser(page, { role: 'candidate' })
    await page.goto('/account')
    await expect(page.getByText('Email notifications', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Turn off status emails' }).click()
    await expect(page.getByText('Status emails turned off')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Turn on status emails' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Turn on status emails' })).toBeVisible()
  })

  test('an employer does not see the card', async ({ page }) => {
    await signedInVerifiedUser(page, { role: 'employer' })
    await page.goto('/account')
    await expect(page.getByText('Change email', { exact: true })).toBeVisible()
    await expect(page.getByText('Email notifications', { exact: true })).toHaveCount(0)
  })
})
