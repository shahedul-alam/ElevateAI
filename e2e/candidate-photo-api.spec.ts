import { expect, test } from '@playwright/test'
import { registerUser } from './support/auth'
import { applyApi, MISSING_ID, newCandidate, newEmployer, publishReactJob, reactProfile } from './support/matching'
import { listHiring } from './support/hiring'
import { gifImage, jpegImage, pngImage, pngOfSize, webpImage } from './support/images'
import { PHOTO_LIMIT, photoBytes, photoInfoApi, putPhoto, uploadPhotoApi } from './support/photo'
import { listVersionsApi, saveProfileApi, profileContent } from './support/profile'

const PHOTO_URL = /^\/api\/candidate\/profile\/photo\?v=[0-9a-f]{64}$/
const EMPLOYER_PHOTO_URL = /^\/api\/employer\/applications\/[0-9a-f-]{36}\/photo\?v=[0-9a-f]{64}$/

test.describe('candidate photo access', () => {
  test('rejects anonymous requests with 401', async ({ request }) => {
    expect((await putPhoto(request, pngImage())).status()).toBe(401)
    expect((await request.get('/api/candidate/profile/photo-info')).status()).toBe(401)
    expect((await request.get('/api/candidate/profile/photo')).status()).toBe(401)
    expect((await request.delete('/api/candidate/profile/photo')).status()).toBe(401)
  })

  test('forbids employers with 403', async ({ request }) => {
    await registerUser(request, { role: 'employer' })
    expect((await putPhoto(request, pngImage())).status()).toBe(403)
    expect((await request.get('/api/candidate/profile/photo-info')).status()).toBe(403)
    expect((await request.get('/api/candidate/profile/photo')).status()).toBe(403)
    expect((await request.delete('/api/candidate/profile/photo')).status()).toBe(403)
  })
})

test.describe('uploading a photo', () => {
  test('stores a PNG and returns a versioned URL that serves the same bytes', async ({ request }) => {
    await registerUser(request)
    const photoUrl = await uploadPhotoApi(request, pngImage(10))
    expect(photoUrl).toMatch(PHOTO_URL)
    expect(await photoInfoApi(request)).toBe(photoUrl)

    const { body, contentType } = await photoBytes(request, '/api/candidate/profile/photo')
    expect(contentType).toBe('image/png')
    expect(body.equals(pngImage(10))).toBe(true)
  })

  test('accepts a JPEG', async ({ request }) => {
    await registerUser(request)
    await uploadPhotoApi(request, jpegImage(), 'image/jpeg')
    const { contentType } = await photoBytes(request, '/api/candidate/profile/photo')
    expect(contentType).toBe('image/jpeg')
  })

  test('decides the type from the bytes, not the header', async ({ request }) => {
    await registerUser(request)
    // A PNG sent with a JPEG header is still stored as the PNG it is.
    await uploadPhotoApi(request, pngImage(11), 'image/jpeg')
    const { contentType } = await photoBytes(request, '/api/candidate/profile/photo')
    expect(contentType).toBe('image/png')
  })

  test('returns the same URL for the same bytes and a new one for a changed photo', async ({ request }) => {
    await registerUser(request)
    const first = await uploadPhotoApi(request, pngImage(12))
    expect(await uploadPhotoApi(request, pngImage(12))).toBe(first)
    const changed = await uploadPhotoApi(request, pngImage(13))
    expect(changed).not.toBe(first)
    expect(await photoInfoApi(request)).toBe(changed)
    expect((await photoBytes(request, '/api/candidate/profile/photo')).body.equals(pngImage(13))).toBe(true)
  })

  test('answers 304 when the browser already has the current photo', async ({ request }) => {
    await registerUser(request)
    await uploadPhotoApi(request, pngImage(14))
    const first = await request.get('/api/candidate/profile/photo')
    const etag = first.headers()['etag']
    expect(etag).toBeTruthy()
    const cached = await request.get('/api/candidate/profile/photo', { headers: { 'If-None-Match': etag! } })
    expect(cached.status()).toBe(304)
  })

  test('accepts a photo before the first resume is saved, without creating a resume version', async ({ request }) => {
    await registerUser(request)
    await uploadPhotoApi(request, pngImage(15))
    expect(await listVersionsApi(request)).toEqual([])

    await saveProfileApi(request, profileContent())
    expect(await listVersionsApi(request)).toHaveLength(1)
    await uploadPhotoApi(request, pngImage(16))
    expect(await listVersionsApi(request)).toHaveLength(1)
  })

  test('accepts exactly 512 KB', async ({ request }) => {
    await registerUser(request)
    expect((await putPhoto(request, pngOfSize(PHOTO_LIMIT))).status()).toBe(200)
  })

  test('rejects a photo over 512 KB with 413 and keeps the current one', async ({ request }) => {
    await registerUser(request)
    const current = await uploadPhotoApi(request, pngImage(17))
    expect((await putPhoto(request, pngOfSize(PHOTO_LIMIT + 1))).status()).toBe(413)
    expect(await photoInfoApi(request)).toBe(current)
  })

  test('rejects WebP, GIF, text and empty bodies with 415 and keeps the current photo', async ({ request }) => {
    await registerUser(request)
    const current = await uploadPhotoApi(request, pngImage(18))

    expect((await putPhoto(request, webpImage(), 'image/webp')).status()).toBe(415)
    expect((await putPhoto(request, gifImage(), 'image/gif')).status()).toBe(415)
    expect((await putPhoto(request, Buffer.from('not an image at all'), 'text/plain')).status()).toBe(415)
    expect((await putPhoto(request, Buffer.from('not an image at all'), 'image/png')).status()).toBe(415)
    expect((await putPhoto(request, Buffer.alloc(0), 'image/png')).status()).toBe(415)
    expect((await putPhoto(request, pngImage(), 'text/html')).status()).toBe(415)

    expect(await photoInfoApi(request)).toBe(current)
  })

  test('removing a photo keeps the bytes for another candidate who uploaded the same image', async ({ playwright, baseURL }) => {
    const shared = pngImage(19)
    const first = await newCandidate(playwright, baseURL)
    const second = await newCandidate(playwright, baseURL)
    await uploadPhotoApi(first.ctx, shared)
    await uploadPhotoApi(second.ctx, shared)

    await first.ctx.delete('/api/candidate/profile/photo')
    expect(await photoInfoApi(second.ctx)).toMatch(PHOTO_URL)
    expect((await photoBytes(second.ctx, '/api/candidate/profile/photo')).body.equals(shared)).toBe(true)
    await first.ctx.dispose()
    await second.ctx.dispose()
  })
})

test.describe('removing a photo', () => {
  test('removes the photo; the photo URL then answers 404', async ({ request }) => {
    await registerUser(request)
    await uploadPhotoApi(request, pngImage(20))

    const res = await request.delete('/api/candidate/profile/photo')
    expect(res.status()).toBe(200)
    expect((await res.json()).photoUrl).toBeNull()
    expect(await photoInfoApi(request)).toBeNull()
    expect((await request.get('/api/candidate/profile/photo')).status()).toBe(404)
  })

  test('removing when there is no photo is harmless', async ({ request }) => {
    await registerUser(request)
    const res = await request.delete('/api/candidate/profile/photo')
    expect(res.status()).toBe(200)
    expect((await res.json()).photoUrl).toBeNull()
  })

  test('a candidate with no photo gets a 404 for the photo', async ({ request }) => {
    await registerUser(request)
    expect((await request.get('/api/candidate/profile/photo')).status()).toBe(404)
    expect(await photoInfoApi(request)).toBeNull()
  })
})

test.describe('the photo on applications', () => {
  test('the employer sees the photo the candidate applied with, and it stays put when the candidate changes it', async ({
    playwright,
    baseURL,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    const applied = await uploadPhotoApi(candidate.ctx, pngImage(30))
    const application = await applyApi(candidate.ctx, job.id)

    const [listed] = (await listHiring(employer.ctx)).applicants
    expect(listed!.photoUrl).toMatch(EMPLOYER_PHOTO_URL)
    expect(listed!.photoUrl).toContain(`/api/employer/applications/${application.id}/photo?v=`)
    expect(listed!.photoUrl?.endsWith(applied.split('?v=')[1]!)).toBe(true)

    const before = await photoBytes(employer.ctx, listed!.photoUrl!)
    expect(before.contentType).toBe('image/png')
    expect(before.body.equals(pngImage(30))).toBe(true)

    // The candidate replaces, then removes, the photo after applying.
    await uploadPhotoApi(candidate.ctx, pngImage(31))
    expect(await photoInfoApi(candidate.ctx)).not.toBe(applied)
    const afterReplace = await photoBytes(employer.ctx, listed!.photoUrl!)
    expect(afterReplace.body.equals(pngImage(30))).toBe(true)

    await candidate.ctx.delete('/api/candidate/profile/photo')
    const afterRemove = await photoBytes(employer.ctx, listed!.photoUrl!)
    expect(afterRemove.body.equals(pngImage(30))).toBe(true)
    expect((await listHiring(employer.ctx)).applicants[0]!.photoUrl).toBe(listed!.photoUrl)

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('an application made without a photo has no photo for the employer', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    const application = await applyApi(candidate.ctx, job.id)

    const [listed] = (await listHiring(employer.ctx)).applicants
    expect(listed!.photoUrl).toBeNull()
    expect((await employer.ctx.get(`/api/employer/applications/${application.id}/photo`)).status()).toBe(404)

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('a photo added after applying does not reach the employer', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    const application = await applyApi(candidate.ctx, job.id)

    await uploadPhotoApi(candidate.ctx, pngImage(32))
    expect((await listHiring(employer.ctx)).applicants[0]!.photoUrl).toBeNull()
    expect((await employer.ctx.get(`/api/employer/applications/${application.id}/photo`)).status()).toBe(404)

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test('a photo removed before applying is not sent', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    await uploadPhotoApi(candidate.ctx, pngImage(33))
    await candidate.ctx.delete('/api/candidate/profile/photo')
    await applyApi(candidate.ctx, job.id)

    expect((await listHiring(employer.ctx)).applicants[0]!.photoUrl).toBeNull()

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
  })

  test("only the job's own employer can read the photo; others get 404, candidates 403, anonymous 401", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const candidate = await newCandidate(playwright, baseURL, reactProfile(3))
    await uploadPhotoApi(candidate.ctx, pngImage(34))
    const application = await applyApi(candidate.ctx, job.id)
    const path = `/api/employer/applications/${application.id}/photo`

    const other = await newEmployer(playwright, baseURL)
    expect((await other.ctx.get(path)).status()).toBe(404)
    expect((await employer.ctx.get(`/api/employer/applications/${MISSING_ID}/photo`)).status()).toBe(404)
    expect((await employer.ctx.get('/api/employer/applications/not-a-uuid/photo')).status()).toBe(404)
    expect((await candidate.ctx.get(path)).status()).toBe(403)
    expect((await request.get(path)).status()).toBe(401)

    await candidate.ctx.dispose()
    await employer.ctx.dispose()
    await other.ctx.dispose()
  })
})
