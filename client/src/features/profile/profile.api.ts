import { api } from '@/lib/api'
import type { Contact, ProfileContent, ProfileSavePayload } from './profile.schema'

export type ProfileVersion = {
  id: string
  createdAt: string
  isCurrent: boolean
  content: ProfileContent
}

export type CurrentProfile = ProfileVersion & {
  termNames: Record<string, string>
  contact: Contact
}

export async function fetchProfile() {
  const { data } = await api.get<{ profile: CurrentProfile | null }>('/candidate/profile')
  return data.profile
}

export async function saveProfileRequest(content: ProfileSavePayload) {
  const { data } = await api.put<{ profile: ProfileVersion }>('/candidate/profile', content)
  return data.profile
}

export const PHOTO_TYPES = ['image/png', 'image/jpeg']
export const PHOTO_MAX_BYTES = 512 * 1024

/** The photo's URL (carries a content hash, so it changes when the photo does), or null. */
export async function fetchPhotoInfo() {
  const { data } = await api.get<{ photoUrl: string | null }>('/candidate/profile/photo-info')
  return data.photoUrl
}

export async function uploadPhotoRequest(file: File) {
  const { data } = await api.put<{ photoUrl: string }>('/candidate/profile/photo', file, {
    headers: { 'Content-Type': file.type },
  })
  return data.photoUrl
}

export const RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
export const RESUME_MAX_BYTES = 5 * 1024 * 1024

/** Reads a resume file with AI and returns content for the form. Nothing is saved. */
export async function importResumeRequest(file: File) {
  const { data } = await api.post<{ content: ProfileContent; termNames: Record<string, string> }>(
    '/candidate/profile/import',
    file,
    { headers: { 'Content-Type': file.type }, timeout: 90_000 },
  )
  return data
}

export async function removePhotoRequest() {
  await api.delete('/candidate/profile/photo')
}

/** The photo as a data URL, so the resume sheet and the PDF can draw it with no cookies or CORS involved. */
export async function fetchPhotoDataUrl(photoUrl: string) {
  const { data } = await api.get<Blob>(photoUrl.replace(/^\/api/, ''), { responseType: 'blob' })
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(data)
  })
}

export async function fetchVersions() {
  const { data } = await api.get<{ versions: ProfileVersion[]; termNames: Record<string, string> }>(
    '/candidate/profile/versions',
  )
  return data
}

export async function restoreVersionRequest(id: string) {
  const { data } = await api.post<{ profile: ProfileVersion }>(
    `/candidate/profile/versions/${id}/restore`,
  )
  return data.profile
}
