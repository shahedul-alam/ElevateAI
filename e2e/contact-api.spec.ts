import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import {
  applyApi,
  getGap,
  listApplicants,
  newCandidate,
  newEmployer,
  publishReactJob,
  reactProfile,
} from './support/matching'
import {
  EMPTY_CONTACT,
  getProfileApi,
  listVersionsApi,
  profileContent,
  saveProfileApi,
  type Contact,
} from './support/profile'

const CONTACT: Contact = {
  phone: '+1 (555) 010-0199',
  email: 'reach.me@example.com',
  city: 'Lisbon',
  country: 'Portugal',
  linkedin: 'https://www.linkedin.com/in/e2e-person',
  github: 'https://github.com/e2e-person',
  website: 'https://e2e-person.example.com/portfolio',
  other: 'http://example.org/other',
}

const putProfile = (request: Parameters<typeof saveProfileApi>[0], contact?: Partial<Contact>) =>
  request.put('/api/candidate/profile', { data: profileContent({ contact }) })

test.describe('contact details access', () => {
  test('rejects an anonymous save with 401', async ({ request }) => {
    const res = await putProfile(request, CONTACT)
    expect(res.status()).toBe(401)
  })

  test('rejects an employer save with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    const res = await putProfile(request, CONTACT)
    expect(res.status()).toBe(403)
  })
})

test.describe('contact details validation', () => {
  const invalid: [string, Partial<Contact>][] = [
    ['letters in the phone', { phone: 'call me maybe' }],
    ['a too short phone', { phone: '1234' }],
    ['a too long phone number', { phone: '1'.repeat(26) }],
    ['a malformed email', { email: 'not-an-email' }],
    ['an over-length email', { email: `${'a'.repeat(250)}@x.io` }],
    ['an over-length city', { city: 'c'.repeat(81) }],
    ['an over-length country', { country: 'c'.repeat(81) }],
    ['a bare domain as linkedin', { linkedin: 'linkedin.com/in/me' }],
    ['an ftp link', { website: 'ftp://example.com/file' }],
    ['a data: link', { other: 'data:text/html,<script>alert(1)</script>' }],
    ['an over-length link', { github: `https://example.com/${'a'.repeat(190)}` }],
    ...(['linkedin', 'github', 'website', 'other'] as const).map(
      (field): [string, Partial<Contact>] => [`a javascript: link in ${field}`, { [field]: 'javascript:alert(1)' }],
    ),
  ]

  for (const [name, bad] of invalid) {
    test(`rejects ${name} with 400 and stores nothing`, async ({ request }) => {
      await registerUser(request)
      await saveProfileApi(request, profileContent({ contact: CONTACT }))

      const res = await putProfile(request, { ...CONTACT, ...bad })
      expect(res.status(), await res.text()).toBe(400)

      expect((await getProfileApi(request)).contact).toEqual(CONTACT)
    })
  }

  test('stores nothing for a first-ever invalid save', async ({ request }) => {
    await registerUser(request)
    expect((await putProfile(request, { phone: 'abc' })).status()).toBe(400)
    expect(await listVersionsApi(request)).toEqual([])
    const res = await request.get('/api/candidate/profile')
    expect((await res.json()).profile).toBeNull()
  })

  test('round-trips valid values exactly, trimming whitespace and accepting the length limits', async ({ request }) => {
    await registerUser(request)
    await saveProfileApi(
      request,
      profileContent({
        contact: {
          phone: '  +44 20 7946 0958  ',
          email: '  Person@Example.com ',
          city: ' Berlin ',
          country: ' Germany ',
          linkedin: ' https://linkedin.com/in/x ',
          github: 'http://github.com/x',
          website: `https://example.com/${'a'.repeat(180)}`,
          other: '',
        },
      }),
    )
    const { contact } = await getProfileApi(request)
    expect(contact).toEqual({
      phone: '+44 20 7946 0958',
      email: 'Person@Example.com',
      city: 'Berlin',
      country: 'Germany',
      linkedin: 'https://linkedin.com/in/x',
      github: 'http://github.com/x',
      website: `https://example.com/${'a'.repeat(180)}`,
      other: '',
    })

    await saveProfileApi(request, profileContent({ contact: { ...CONTACT, city: 'c'.repeat(80), phone: '1'.repeat(25) } }))
    expect((await getProfileApi(request)).contact).toEqual({ ...CONTACT, city: 'c'.repeat(80), phone: '1'.repeat(25) })
  })
})

test.describe('contact details persistence', () => {
  test('keeps contact when a later save omits it, and clears it with an empty object', async ({ request }) => {
    await registerUser(request)
    await saveProfileApi(request, profileContent({ contact: CONTACT }))
    expect((await getProfileApi(request)).contact).toEqual(CONTACT)

    await saveProfileApi(request, profileContent({ headline: 'Resume-only change' }))
    const afterOmit = await getProfileApi(request)
    expect(afterOmit.content.headline).toBe('Resume-only change')
    expect(afterOmit.contact).toEqual(CONTACT)

    await saveProfileApi(request, profileContent({ headline: 'Resume-only change', contact: {} }))
    expect((await getProfileApi(request)).contact).toEqual(EMPTY_CONTACT)
  })

  test('replaces the whole contact: fields left out of a provided contact become empty', async ({ request }) => {
    await registerUser(request)
    await saveProfileApi(request, profileContent({ contact: CONTACT }))
    await saveProfileApi(request, profileContent({ contact: { city: 'Oslo' } }))
    expect((await getProfileApi(request)).contact).toEqual({ ...EMPTY_CONTACT, city: 'Oslo' })
  })

  test('returns empty contact for a profile that never set one', async ({ request }) => {
    await registerUser(request)
    await saveProfileApi(request, profileContent())
    expect((await getProfileApi(request)).contact).toEqual(EMPTY_CONTACT)
  })

  test('a contact-only change creates no version and leaves the gap score identical', async ({
    request,
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    await employer.ctx.dispose()

    await registerUser(request)
    const first = await saveProfileApi(request, reactProfile(3))
    const before = await getProfileApi(request)
    const gapBefore = await getGap(request, job.id)

    const same = await saveProfileApi(request, reactProfile(3, { contact: CONTACT }))
    expect(same.id).toBe(first.id)
    const after = await getProfileApi(request)
    expect(after.id).toBe(before.id)
    expect(after.contact).toEqual(CONTACT)
    expect(await listVersionsApi(request)).toHaveLength(1)

    const gapAfter = await getGap(request, job.id)
    expect(gapAfter.profileVersionId).toBe(gapBefore.profileVersionId)
    expect(gapAfter.score).toBe(gapBefore.score)
    expect(gapAfter.dimensions).toEqual(gapBefore.dimensions)
  })

  test('restoring an older version leaves the contact unchanged', async ({ request }) => {
    await registerUser(request)
    const a = await saveProfileApi(request, profileContent({ headline: 'Version A', contact: { city: 'Rome' } }))
    await saveProfileApi(request, profileContent({ headline: 'Version B', contact: CONTACT }))

    const restore = await request.post(`/api/candidate/profile/versions/${a.id}/restore`)
    expect(restore.status()).toBe(200)

    const profile = await getProfileApi(request)
    expect(profile.content.headline).toBe('Version A')
    expect(profile.contact).toEqual(CONTACT)
    expect(await listVersionsApi(request)).toHaveLength(2)
  })
})

test.describe('contact details in the applicant view', () => {
  test('shows phone, location, labelled links and the contact email to the employer', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3, { contact: CONTACT }))
    await applyApi(candidate.ctx, job.id)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants).toHaveLength(1)
    expect(applicants[0]!.candidateEmail).toBe(CONTACT.email)
    expect(applicants[0]!.contact).toEqual({
      phone: CONTACT.phone,
      city: CONTACT.city,
      country: CONTACT.country,
      links: [
        { label: 'LinkedIn', url: CONTACT.linkedin },
        { label: 'GitHub', url: CONTACT.github },
        { label: 'Website', url: CONTACT.website },
        { label: 'Other', url: CONTACT.other },
      ],
    })
    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('falls back to the account email and lists only the links that are set', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)
    const candidate = await newCandidate(
      playwright,
      baseURL,
      reactProfile(3, { contact: { phone: '555 0100', github: 'https://github.com/only-github' } }),
    )
    await applyApi(candidate.ctx, job.id)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants[0]!.candidateEmail).toBe(candidate.user.email)
    expect(applicants[0]!.contact).toEqual({
      phone: '555 0100',
      city: '',
      country: '',
      links: [{ label: 'GitHub', url: 'https://github.com/only-github' }],
    })
    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('returns empty contact and the account email for a candidate who never set contact', async ({
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    await applyApi(candidate.ctx, job.id)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    expect(applicants[0]!.candidateEmail).toBe(candidate.user.email)
    expect(applicants[0]!.contact).toEqual({ phone: '', city: '', country: '', links: [] })
    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('shows updated contact live while the resume stays the frozen snapshot', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3, { headline: 'Applied headline', contact: CONTACT }))
    await applyApi(candidate.ctx, job.id)

    const updated: Partial<Contact> = {
      phone: '+49 30 1234567',
      city: 'Hamburg',
      country: 'Germany',
      linkedin: 'https://linkedin.com/in/new-me',
    }
    await saveProfileApi(candidate.ctx, reactProfile(3, { headline: 'Edited headline', contact: updated }))

    const { applicants } = await listApplicants(employer.ctx, job.id)
    const [applicant] = applicants
    expect(applicant!.contact).toEqual({
      phone: '+49 30 1234567',
      city: 'Hamburg',
      country: 'Germany',
      links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/new-me' }],
    })
    // Contact email was cleared by the replace, so it falls back to the account email.
    expect(applicant!.candidateEmail).toBe(candidate.user.email)
    expect(applicant!.resume.headline).toBe('Applied headline')
    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('does not expose the applicants or their contact to another employer', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const other = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3, { contact: CONTACT }))
    await applyApi(candidate.ctx, job.id)

    const res = await other.ctx.get(`/api/employer/jobs/${job.id}/applicants`)
    expect(res.status()).toBe(404)
    expect(await res.text()).not.toContain(CONTACT.phone)

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
    await other.ctx.dispose()
  })

  test('still keeps private preferences out of the applicant payload when contact is set', async ({
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 3)
    const candidate = await newCandidate(
      playwright,
      baseURL,
      reactProfile(3, {
        contact: CONTACT,
        preferences: { locations: ['Atlantis'], workModes: ['remote'], minSalary: 123456 },
      }),
    )
    await applyApi(candidate.ctx, job.id)

    const { applicants } = await listApplicants(employer.ctx, job.id)
    const raw = JSON.stringify(applicants[0])
    for (const leaked of ['preferences', 'minSalary', 'workModes', 'Atlantis', '123456']) {
      expect(raw).not.toContain(leaked)
    }
    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })
})
