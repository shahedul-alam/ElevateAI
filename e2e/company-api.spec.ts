import { randomUUID } from 'node:crypto'
import {
  closedJob,
  companyPayload,
  expect,
  getMyCompany,
  getPublicCompany,
  jpegImage,
  pngImage,
  pngOfSize,
  putCompany,
  publishJobWith,
  saveCompany,
  setVerified,
  test,
  updateCompany,
  uploadImage,
  uniqueCompanyName,
  webpImage,
} from './support/company'
import { createJobApi } from './support/jobs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

test.describe('own company', () => {
  test('a new employer already has a company named after the account', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const res = await api.get('/api/employer/company')
    expect(res.status()).toBe(200)
    const { company } = await res.json()
    expect(company).toMatchObject({
      name: user.name,
      verified: false,
      logoUrl: null,
      coverUrl: null,
      tagline: '',
      culture: [],
      benefits: [],
      hubs: [],
      awards: [],
      domainId: null,
      workPolicy: null,
      foundedYear: null,
    })
    expect(company.id).toMatch(UUID)
  })

  test('saves and returns every field', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const payload = companyPayload(user.name)
    const saved = await saveCompany(api, payload)
    expect(saved).toMatchObject(payload)
    expect(saved.verified).toBe(false)
    expect(await getMyCompany(api)).toEqual(saved)
  })

  test('the profile is replaced as a whole on each save', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    await saveCompany(api, companyPayload(user.name))
    const saved = await saveCompany(api, { name: user.name })
    expect(saved).toMatchObject({ tagline: '', benefits: [], awards: [], domainId: null, foundedYear: null })
  })

  test('ignores a verified flag sent by the employer', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const saved = await saveCompany(api, companyPayload(user.name, { verified: true }))
    expect(saved.verified).toBe(false)
    expect((await getMyCompany(api)).verified).toBe(false)
  })

  test('ignores an id sent in the body', async ({ newEmployer }) => {
    const a = await newEmployer()
    const b = await newEmployer()
    await saveCompany(a.api, companyPayload(a.user.name, { id: b.company.id, tagline: 'Only A' }))
    expect((await getMyCompany(a.api)).id).toBe(a.company.id)
    expect((await getMyCompany(b.api)).tagline).toBe('')
  })

  const year = new Date().getFullYear()
  const invalid: [string, Record<string, unknown>][] = [
    ['a javascript: website', { website: 'javascript:alert(1)' }],
    ['a data: website', { website: 'data:text/html,<script>alert(1)</script>' }],
    ['a javascript: linkedin link', { links: { linkedin: 'javascript:alert(1)', github: '', x: '' } }],
    ['a javascript: github link', { links: { linkedin: '', github: 'javascript:alert(1)', x: '' } }],
    ['a javascript: x link', { links: { linkedin: '', github: '', x: 'javascript:alert(1)' } }],
    ['a link without a scheme', { website: 'example.com' }],
    ['a founded year in the future', { foundedYear: year + 1 }],
    ['a founded year below 1800', { foundedYear: 1799 }],
    ['a non-integer founded year', { foundedYear: 2000.5 }],
    ['21 benefits', { benefits: Array.from({ length: 21 }, (_, i) => `Benefit ${i}`) }],
    ['21 hubs', { hubs: Array.from({ length: 21 }, (_, i) => `Hub ${i}`) }],
    ['a blank benefit', { benefits: ['  '] }],
    [
      'more than 8 culture items',
      { culture: Array.from({ length: 9 }, (_, i) => ({ title: `Value ${i}`, description: '' })) },
    ],
    ['a culture item without a title', { culture: [{ title: '', description: 'No title' }] }],
    ['an award with an empty title', { awards: [{ title: '', issuer: 'Someone', year: 2020 }] }],
    ['an award without a title', { awards: [{ issuer: 'Someone', year: 2020 }] }],
    ['an award year in the future', { awards: [{ title: 'Future award', issuer: '', year: year + 1 }] }],
    ['a domain that is not in the catalog', { domainId: 'domain:does-not-exist' }],
    ['a domain id with the wrong shape', { domainId: 'saas' }],
    ['an invalid work policy', { workPolicy: 'moon' }],
    ['an invalid company size', { size: '5' }],
    ['an invalid funding stage', { fundingStage: 'Unicorn' }],
    ['a tagline over 160 characters', { tagline: 'x'.repeat(161) }],
    ['an empty name', { name: '   ' }],
  ]
  for (const [label, patch] of invalid) {
    test(`rejects ${label} with 400`, async ({ newEmployer }) => {
      const { api, user } = await newEmployer()
      const res = await putCompany(api, companyPayload(user.name, patch))
      expect(res.status(), await res.text()).toBe(400)
      expect((await res.json()).error.message).toBeTruthy()
    })
  }

  test('keeps the stored profile when a save is rejected', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const saved = await saveCompany(api, companyPayload(user.name))
    const res = await putCompany(api, companyPayload('Renamed', { website: 'javascript:alert(1)' }))
    expect(res.status()).toBe(400)
    expect(await getMyCompany(api)).toEqual(saved)
  })

  test('accepts the boundary values', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const saved = await saveCompany(
      api,
      companyPayload(user.name, {
        foundedYear: 1800,
        benefits: Array.from({ length: 20 }, (_, i) => `Benefit ${i}`),
        culture: Array.from({ length: 8 }, (_, i) => ({ title: `Value ${i}`, description: '' })),
        awards: [{ title: 'This year', issuer: '', year: year }],
        size: '1000+',
        workPolicy: 'remote_first',
      }),
    )
    expect(saved.benefits).toHaveLength(20)
    expect(saved.culture).toHaveLength(8)
    expect(saved.foundedYear).toBe(1800)
  })
})

test.describe('year limits follow the current year', () => {
  const thisYear = new Date().getFullYear()

  test('accepts the current year as founded year and award year', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const saved = await saveCompany(
      api,
      companyPayload(user.name, {
        foundedYear: thisYear,
        awards: [{ title: 'Current year award', issuer: '', year: thisYear }],
      }),
    )
    expect(saved.foundedYear).toBe(thisYear)
    expect(saved.awards[0]?.year).toBe(thisYear)
  })

  test('rejects next year as founded year', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const res = await putCompany(api, companyPayload(user.name, { foundedYear: thisYear + 1 }))
    expect(res.status(), await res.text()).toBe(400)
  })

  test('rejects next year as award year', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const res = await putCompany(
      api,
      companyPayload(user.name, { awards: [{ title: 'Next year', issuer: '', year: thisYear + 1 }] }),
    )
    expect(res.status(), await res.text()).toBe(400)
  })

  test('keeps the lower bounds: 1800 founded is fine, 1799 is not', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    expect((await saveCompany(api, companyPayload(user.name, { foundedYear: 1800 }))).foundedYear).toBe(1800)
    expect((await putCompany(api, companyPayload(user.name, { foundedYear: 1799 }))).status()).toBe(400)
  })

  test('award years from 1900 are accepted and 1899 is not', async ({ newEmployer }) => {
    const { api, user } = await newEmployer()
    const award = (year: number) => ({ awards: [{ title: 'Old award', issuer: '', year }] })
    expect((await putCompany(api, companyPayload(user.name, award(1900)))).status()).toBe(200)
    expect((await putCompany(api, companyPayload(user.name, award(1899)))).status()).toBe(400)
  })
})

test.describe('who can use the employer endpoints', () => {
  test('anonymous callers get 401', async ({ request }) => {
    expect((await request.get('/api/employer/company')).status()).toBe(401)
    expect((await putCompany(request, companyPayload('Anon'))).status()).toBe(401)
    expect((await uploadImage(request, 'logo', pngImage())).status()).toBe(401)
    expect((await request.delete('/api/employer/company/logo')).status()).toBe(401)
  })

  test('candidates get 403 and cannot upload an image', async ({ newCandidate }) => {
    const { api } = await newCandidate()
    expect((await api.get('/api/employer/company')).status()).toBe(403)
    expect((await putCompany(api, companyPayload('Candidate Co'))).status()).toBe(403)
    expect((await uploadImage(api, 'logo', pngImage())).status()).toBe(403)
    expect((await uploadImage(api, 'cover', pngImage())).status()).toBe(403)
    expect((await api.delete('/api/employer/company/logo')).status()).toBe(403)
  })

  test('an employer only ever edits their own company', async ({ newEmployer, request }) => {
    const a = await newEmployer()
    const b = await newEmployer()
    expect(a.company.id).not.toBe(b.company.id)

    await saveCompany(a.api, companyPayload(a.user.name, { tagline: 'Tagline of A' }))
    await saveCompany(b.api, companyPayload(b.user.name, { tagline: 'Tagline of B' }))
    expect((await uploadImage(a.api, 'logo', pngImage())).status()).toBe(200)

    expect((await getMyCompany(a.api)).tagline).toBe('Tagline of A')
    const bNow = await getMyCompany(b.api)
    expect(bNow.tagline).toBe('Tagline of B')
    expect(bNow.logoUrl).toBeNull()

    // The company id is never part of the employer routes, so there is nothing to point at B's company.
    expect((await request.get(`/api/companies/${b.company.id}/logo`)).status()).toBe(404)
  })
})

test.describe('verification', () => {
  test('an admin can verify and unverify a company', async ({ newEmployer, adminApi, request }) => {
    const { api, company } = await newEmployer()
    const on = await adminApi.patch(`/api/admin/companies/${company.id}/verification`, { data: { verified: true } })
    expect(on.status()).toBe(200)
    expect(await on.json()).toEqual({ id: company.id, verified: true })
    expect((await getMyCompany(api)).verified).toBe(true)
    expect((await getPublicCompany(request, company.id)).company.verified).toBe(true)

    const off = await adminApi.patch(`/api/admin/companies/${company.id}/verification`, { data: { verified: false } })
    expect(await off.json()).toEqual({ id: company.id, verified: false })
    expect((await getMyCompany(api)).verified).toBe(false)
  })

  test('employers cannot verify, not even their own company', async ({ newEmployer }) => {
    const { api, company } = await newEmployer()
    const res = await api.patch(`/api/admin/companies/${company.id}/verification`, { data: { verified: true } })
    expect(res.status()).toBe(403)
    expect((await getMyCompany(api)).verified).toBe(false)
  })

  test('candidates get 403', async ({ newEmployer, newCandidate }) => {
    const { company } = await newEmployer()
    const { api } = await newCandidate()
    const res = await api.patch(`/api/admin/companies/${company.id}/verification`, { data: { verified: true } })
    expect(res.status()).toBe(403)
  })

  test('anonymous callers get 401', async ({ newEmployer, request }) => {
    const { company } = await newEmployer()
    const res = await request.patch(`/api/admin/companies/${company.id}/verification`, { data: { verified: true } })
    expect(res.status()).toBe(401)
  })

  test('a malformed or unknown id is 404', async ({ adminApi }) => {
    const bad = await adminApi.patch('/api/admin/companies/not-a-uuid/verification', { data: { verified: true } })
    expect(bad.status()).toBe(404)
    const unknown = await adminApi.patch(`/api/admin/companies/${randomUUID()}/verification`, {
      data: { verified: true },
    })
    expect(unknown.status()).toBe(404)
  })

  test('rejects a body without a boolean', async ({ newEmployer, adminApi }) => {
    const { company } = await newEmployer()
    const res = await adminApi.patch(`/api/admin/companies/${company.id}/verification`, {
      data: { verified: 'yes' },
    })
    expect(res.status()).toBe(400)
  })

  const identityChanges: [string, Record<string, unknown>][] = [
    ['name', { name: `Renamed ${Date.now()}` }],
    ['website', { website: 'https://other.example.com' }],
    ['LinkedIn link', { links: { linkedin: 'https://www.linkedin.com/company/other', github: '', x: '' } }],
    ['GitHub link', { links: { linkedin: '', github: 'https://github.com/other', x: '' } }],
    ['X link', { links: { linkedin: '', github: '', x: 'https://x.com/other' } }],
  ]
  for (const [label, change] of identityChanges) {
    test(`changing the ${label} revokes the verified badge`, async ({ newEmployer, adminApi }) => {
      const { api, user, company } = await newEmployer()
      await saveCompany(api, companyPayload(user.name, { links: { linkedin: '', github: '', x: '' } }))
      await setVerified(adminApi, company.id, true)
      expect((await getMyCompany(api)).verified).toBe(true)

      const saved = await updateCompany(api, change)
      expect(saved.verified).toBe(false)
      expect((await getMyCompany(api)).verified).toBe(false)
    })
  }

  test('keeps the badge when only other fields change', async ({ newEmployer, adminApi }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name))
    await setVerified(adminApi, company.id, true)

    const saved = await updateCompany(api, {
      tagline: 'A brand new tagline',
      about: 'New about text',
      mission: 'New mission',
      benefits: ['Only one benefit'],
      domainId: 'domain:fintech',
    })
    expect(saved.verified).toBe(true)
    expect(saved.tagline).toBe('A brand new tagline')
  })

  test('saving identical identity fields keeps the badge', async ({ newEmployer, adminApi }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name))
    await setVerified(adminApi, company.id, true)
    expect((await updateCompany(api, {})).verified).toBe(true)
  })
})

test.describe('images', () => {
  const accepted: [string, () => Buffer, string][] = [
    ['PNG', () => pngImage(), 'image/png'],
    ['JPEG', () => jpegImage(), 'image/jpeg'],
    ['WebP', () => webpImage(), 'image/webp'],
  ]
  for (const kind of ['logo', 'cover'] as const) {
    for (const [label, make, type] of accepted) {
      test(`accepts a ${label} ${kind} and serves it with the right content type`, async ({ newEmployer, request }) => {
        const { api, company } = await newEmployer()
        const res = await uploadImage(api, kind, make(), type)
        expect(res.status(), await res.text()).toBe(200)
        const url = (await res.json()).company[`${kind}Url`] as string
        expect(url).toMatch(new RegExp(`^/api/companies/${company.id}/${kind}\\?v=[0-9a-f]{16}$`))

        const served = await request.get(url)
        expect(served.status()).toBe(200)
        expect(served.headers()['content-type']).toBe(type)
        expect(Buffer.compare(await served.body(), make())).toBe(0)
      })
    }
  }

  test('serves with nosniff, a long immutable cache and an ETag', async ({ newEmployer, request }) => {
    const { api } = await newEmployer()
    const url = (await (await uploadImage(api, 'logo', pngImage())).json()).company.logoUrl as string
    const etag = new URL(url, 'http://x').searchParams.get('v')

    const res = await request.get(url)
    const headers = res.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['cache-control']).toContain('immutable')
    expect(headers['cache-control']).toContain('max-age=31536000')
    expect(headers['etag']).toBe(`"${etag}"`)
  })

  test('answers 304 to a matching If-None-Match and the full image otherwise', async ({ newEmployer, request }) => {
    const { api } = await newEmployer()
    const url = (await (await uploadImage(api, 'cover', pngImage())).json()).company.coverUrl as string
    const etag = (await request.get(url)).headers()['etag']!

    const cached = await request.get(url, { headers: { 'If-None-Match': etag } })
    expect(cached.status()).toBe(304)
    expect((await cached.body()).length).toBe(0)

    const stale = await request.get(url, { headers: { 'If-None-Match': '"something-else"' } })
    expect(stale.status()).toBe(200)
  })

  test('404 for an unknown kind, a missing image, or an unknown company', async ({ newEmployer, request }) => {
    const { api, company } = await newEmployer()
    // No image uploaded yet.
    expect((await request.get(`/api/companies/${company.id}/logo`)).status()).toBe(404)
    expect((await request.get(`/api/companies/${company.id}/cover`)).status()).toBe(404)

    await uploadImage(api, 'logo', pngImage())
    expect((await request.get(`/api/companies/${company.id}/banner`)).status()).toBe(404)
    expect((await request.get(`/api/companies/${randomUUID()}/logo`)).status()).toBe(404)
    expect((await request.get('/api/companies/not-a-uuid/logo')).status()).toBe(404)
    // Only the uploaded kind exists.
    expect((await request.get(`/api/companies/${company.id}/cover`)).status()).toBe(404)
  })

  test('uploading to an unknown kind is 404', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    expect((await uploadImage(api, 'banner', pngImage())).status()).toBe(404)
  })

  test('DELETE removes the image', async ({ newEmployer, request }) => {
    const { api, company } = await newEmployer()
    await uploadImage(api, 'logo', pngImage())
    await uploadImage(api, 'cover', pngImage())

    const res = await api.delete('/api/employer/company/logo')
    expect(res.status()).toBe(200)
    const { company: after } = await res.json()
    expect(after.logoUrl).toBeNull()
    expect(after.coverUrl).not.toBeNull()
    expect((await request.get(`/api/companies/${company.id}/logo`)).status()).toBe(404)
    expect((await request.get(`/api/companies/${company.id}/cover`)).status()).toBe(200)
  })

  test('deleting an image that is not there is harmless', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    const res = await api.delete('/api/employer/company/cover')
    expect(res.status()).toBe(200)
    expect((await res.json()).company.coverUrl).toBeNull()
  })

  test('the version in logoUrl changes when the image changes and not when it does not', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    const first = (await (await uploadImage(api, 'logo', pngImage(1))).json()).company.logoUrl as string
    const same = (await (await uploadImage(api, 'logo', pngImage(1))).json()).company.logoUrl as string
    const changed = (await (await uploadImage(api, 'logo', pngImage(2))).json()).company.logoUrl as string
    expect(same).toBe(first)
    expect(changed).not.toBe(first)
    expect((await getMyCompany(api)).logoUrl).toBe(changed)
  })

  test('rejects a text file sent as image/png with 415', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    const res = await uploadImage(api, 'logo', Buffer.from('this is definitely not an image'), 'image/png')
    expect(res.status()).toBe(415)
    expect((await getMyCompany(api)).logoUrl).toBeNull()
  })

  test('rejects an empty body with 415', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    expect((await uploadImage(api, 'logo', Buffer.alloc(0), 'image/png')).status()).toBe(415)
  })

  test('rejects a wrong content type with 415', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    const res = await uploadImage(api, 'logo', pngImage(), 'text/html')
    expect(res.status()).toBe(415)
    expect((await getMyCompany(api)).logoUrl).toBeNull()
  })

  test('rejects a logo over 512 KB and a cover over 2 MB with 413', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    expect((await uploadImage(api, 'logo', pngOfSize(512 * 1024 + 1))).status()).toBe(413)
    expect((await uploadImage(api, 'cover', pngOfSize(2 * 1024 * 1024 + 1))).status()).toBe(413)
    const company = await getMyCompany(api)
    expect(company.logoUrl).toBeNull()
    expect(company.coverUrl).toBeNull()
  })

  test('accepts a logo of exactly 512 KB', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    const res = await uploadImage(api, 'logo', pngOfSize(512 * 1024))
    expect(res.status(), await res.text()).toBe(200)
  })

  test('a cover may be larger than a logo may be', async ({ newEmployer }) => {
    const { api } = await newEmployer()
    expect((await uploadImage(api, 'logo', pngOfSize(600 * 1024))).status()).toBe(413)
    expect((await uploadImage(api, 'cover', pngOfSize(600 * 1024))).status()).toBe(200)
  })
})

test.describe('public companies', () => {
  test('lists companies, searches by name and counts only active jobs', async ({ newEmployer, request }) => {
    const { api, user } = await newEmployer()
    await publishJobWith(api)
    await createJobApi(api) // draft
    await closedJob(api)

    const res = await request.get(`/api/companies?q=${encodeURIComponent(user.name.toLowerCase())}`)
    expect(res.status()).toBe(200)
    const { companies } = await res.json()
    expect(companies).toHaveLength(1)
    expect(companies[0]).toMatchObject({ name: user.name, verified: false, logoUrl: null, openPositions: 1 })
  })

  test('filters by industry', async ({ newEmployer, request }) => {
    const saas = await newEmployer()
    const fintech = await newEmployer({ name: `${saas.user.name} Two` })
    await saveCompany(saas.api, companyPayload(saas.user.name, { domainId: 'domain:saas' }))
    await saveCompany(fintech.api, companyPayload(fintech.user.name, { domainId: 'domain:fintech' }))

    const q = encodeURIComponent(saas.user.name)
    const onlySaas = (await (await request.get(`/api/companies?q=${q}&domainId=domain:saas`)).json()).companies
    expect(onlySaas.map((c: { id: string }) => c.id)).toEqual([saas.company.id])
    const onlyFintech = (await (await request.get(`/api/companies?q=${q}&domainId=domain:fintech`)).json()).companies
    expect(onlyFintech.map((c: { id: string }) => c.id)).toEqual([fintech.company.id])
  })

  test('lists verified companies first', async ({ newEmployer, adminApi, request }) => {
    const prefix = uniqueCompanyName('Order Test')
    const alpha = await newEmployer({ name: `${prefix} Alpha` })
    const beta = await newEmployer({ name: `${prefix} Beta` })
    await setVerified(adminApi, beta.company.id, true)

    const { companies } = await (await request.get(`/api/companies?q=${encodeURIComponent(prefix)}`)).json()
    expect(companies.map((c: { id: string }) => c.id)).toEqual([beta.company.id, alpha.company.id])
    expect(companies[0].verified).toBe(true)
  })

  test('pages through results with a cursor', async ({ newEmployer, request }) => {
    const prefix = uniqueCompanyName('Page Test')
    const ids: string[] = []
    for (const letter of ['A', 'B', 'C']) ids.push((await newEmployer({ name: `${prefix} ${letter}` })).company.id)

    const q = encodeURIComponent(prefix)
    const first = await (await request.get(`/api/companies?q=${q}&limit=2`)).json()
    expect(first.companies.map((c: { id: string }) => c.id)).toEqual(ids.slice(0, 2))
    expect(first.nextCursor).toBeTruthy()

    const second = await (await request.get(`/api/companies?q=${q}&limit=2&cursor=${first.nextCursor}`)).json()
    expect(second.companies.map((c: { id: string }) => c.id)).toEqual(ids.slice(2))
    expect(second.nextCursor).toBeNull()
  })

  test('paging stays correct when a company is verified between page requests', async ({
    newEmployer,
    adminApi,
    request,
  }) => {
    const prefix = uniqueCompanyName('Shift Test')
    const [a, b, c, d] = [
      await newEmployer({ name: `${prefix} A` }),
      await newEmployer({ name: `${prefix} B` }),
      await newEmployer({ name: `${prefix} C` }),
      await newEmployer({ name: `${prefix} D` }),
    ]
    const q = encodeURIComponent(prefix)
    const ids = (body: { companies: { id: string }[] }) => body.companies.map((x) => x.id)

    const first = await (await request.get(`/api/companies?q=${q}&limit=2`)).json()
    expect(ids(first)).toEqual([a.company.id, b.company.id])
    expect(first.nextCursor).toBeTruthy()

    // A was already shown; D now sorts to the front of the ordering, before the cursor position.
    await setVerified(adminApi, a.company.id, true)
    await setVerified(adminApi, d.company.id, true)

    const second = await (await request.get(`/api/companies?q=${q}&limit=2&cursor=${first.nextCursor}`)).json()
    // Rows strictly after (unverified, B): only C. A and B are not repeated, D is verified and earlier.
    expect(ids(second)).toEqual([c.company.id])
    expect(second.nextCursor).toBeNull()
    expect(ids(second)).not.toContain(a.company.id)
    expect(ids(second)).not.toContain(b.company.id)
  })

  test('a full walk with limit 1 returns every company once, verified first', async ({
    newEmployer,
    adminApi,
    request,
  }) => {
    const prefix = uniqueCompanyName('Walk Test')
    const [a, b, c, d] = [
      await newEmployer({ name: `${prefix} A` }),
      await newEmployer({ name: `${prefix} B` }),
      await newEmployer({ name: `${prefix} C` }),
      await newEmployer({ name: `${prefix} D` }),
    ]
    await setVerified(adminApi, b.company.id, true)
    await setVerified(adminApi, d.company.id, true)

    const q = encodeURIComponent(prefix)
    const seen: string[] = []
    let cursor: string | null = null
    for (let i = 0; i < 10; i += 1) {
      const url: string = `/api/companies?q=${q}&limit=1${cursor ? `&cursor=${cursor}` : ''}`
      const body: { companies: { id: string }[]; nextCursor: string | null } = await (await request.get(url)).json()
      expect(body.companies.length).toBeLessThanOrEqual(1)
      seen.push(...body.companies.map((x) => x.id))
      cursor = body.nextCursor
      if (!cursor) break
    }
    expect(cursor).toBeNull()
    expect(seen).toEqual([b.company.id, d.company.id, a.company.id, c.company.id])
  })

  test.describe('cursor validation', () => {
    const bad: [string, string][] = [
      ['plain text', 'not-a-cursor'],
      ['a bare uuid', randomUUID()],
      ['base64 garbage', Buffer.from('hello world, not json').toString('base64url')],
      ['base64 JSON of the wrong shape', Buffer.from(JSON.stringify({ v: 'yes', n: 1 })).toString('base64url')],
      [
        'base64 JSON with a non-uuid id',
        Buffer.from(JSON.stringify({ v: false, n: 'x', i: 'nope' })).toString('base64url'),
      ],
    ]
    for (const [label, cursor] of bad) {
      test(`rejects ${label} with 400`, async ({ request }) => {
        const res = await request.get(`/api/companies?cursor=${encodeURIComponent(cursor)}`)
        expect(res.status(), await res.text()).toBe(400)
        expect((await res.json()).error.message).toBe('Invalid cursor')
      })
    }

    test('works without a cursor and with a cursor issued by the server', async ({ newEmployer, request }) => {
      const prefix = uniqueCompanyName('Cursor Ok')
      await newEmployer({ name: `${prefix} A` })
      await newEmployer({ name: `${prefix} B` })
      const q = encodeURIComponent(prefix)

      const first = await request.get(`/api/companies?q=${q}&limit=1`)
      expect(first.status()).toBe(200)
      const { nextCursor } = await first.json()
      expect(nextCursor).toBeTruthy()

      const second = await request.get(`/api/companies?q=${q}&limit=1&cursor=${encodeURIComponent(nextCursor)}`)
      expect(second.status()).toBe(200)
      expect((await second.json()).companies).toHaveLength(1)
    })
  })

  test('rejects a malformed query', async ({ request }) => {
    expect((await request.get('/api/companies?limit=0')).status()).toBe(400)
    expect((await request.get('/api/companies?domainId=nope')).status()).toBe(400)
  })

  test('returns the company with only its own active jobs', async ({ newEmployer, request }) => {
    const mine = await newEmployer()
    const other = await newEmployer()
    const active = await publishJobWith(mine.api)
    await createJobApi(mine.api) // draft
    await closedJob(mine.api)
    await publishJobWith(other.api)

    const { company, jobs } = await getPublicCompany(request, mine.company.id)
    expect(company.id).toBe(mine.company.id)
    expect(company.name).toBe(mine.user.name)
    expect(jobs.map((j) => j.id)).toEqual([active.id])
  })

  test('is readable without signing in and includes the saved profile', async ({ newEmployer, request }) => {
    const { api, user, company } = await newEmployer()
    const payload = companyPayload(user.name)
    await saveCompany(api, payload)
    const body = await (await request.get(`/api/companies/${company.id}`)).json()
    expect(body.company).toMatchObject(payload)
    expect(body.termNames['domain:saas']).toBe('SaaS')
  })

  test('a malformed or unknown id is 404', async ({ request }) => {
    expect((await request.get('/api/companies/not-a-uuid')).status()).toBe(404)
    expect((await request.get(`/api/companies/${randomUUID()}`)).status()).toBe(404)
  })

  test('job cards and the job page carry the company and its name', async ({ newEmployer, request }) => {
    const { api, user, company } = await newEmployer()
    await saveCompany(api, companyPayload(user.name, { tagline: 'Jobs with a company' }))
    const job = await publishJobWith(api)

    const list = await (await request.get(`/api/jobs?q=${encodeURIComponent(job.title)}`)).json()
    const card = list.jobs.find((j: { id: string }) => j.id === job.id)
    expect(card.employerName).toBe(user.name)
    expect(card.company).toEqual({
      id: company.id,
      name: user.name,
      tagline: 'Jobs with a company',
      verified: false,
      logoUrl: null,
    })

    const detail = await (await request.get(`/api/jobs/${job.id}`)).json()
    expect(detail.job.employerName).toBe(user.name)
    expect(detail.job.company).toEqual(card.company)
  })

  test('the job company follows a rename, a verification and a new logo', async ({ newEmployer, adminApi, request }) => {
    const { api, user, company } = await newEmployer()
    const job = await publishJobWith(api)
    const newName = `${user.name} Renamed`
    await updateCompany(api, { name: newName })
    await setVerified(adminApi, company.id, true)
    await uploadImage(api, 'logo', pngImage())

    const detail = await (await request.get(`/api/jobs/${job.id}`)).json()
    expect(detail.job.employerName).toBe(newName)
    expect(detail.job.company).toMatchObject({ id: company.id, name: newName, verified: true })
    expect(detail.job.company.logoUrl).toMatch(/^\/api\/companies\/.+\/logo\?v=[0-9a-f]{16}$/)
  })
})
