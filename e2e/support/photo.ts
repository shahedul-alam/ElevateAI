import { expect, type APIRequestContext } from '@playwright/test'

export const PHOTO_LIMIT = 512 * 1024

/** PUT the raw image body as the candidate (no assertion, for failure cases). */
export const putPhoto = (request: APIRequestContext, body: Buffer, contentType = 'image/png') =>
  request.put('/api/candidate/profile/photo', { data: body, headers: { 'Content-Type': contentType } })

export async function uploadPhotoApi(request: APIRequestContext, body: Buffer, contentType = 'image/png') {
  const res = await putPhoto(request, body, contentType)
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).photoUrl as string
}

export async function photoInfoApi(request: APIRequestContext) {
  const res = await request.get('/api/candidate/profile/photo-info')
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()).photoUrl as string | null
}

/** Downloads a photo's bytes and content type (candidate or employer endpoint). */
export async function photoBytes(request: APIRequestContext, path: string) {
  const res = await request.get(path)
  expect(res.status(), await res.text()).toBe(200)
  return { body: await res.body(), contentType: res.headers()['content-type'] }
}
