import { api } from '@/lib/api'
import type { ProfileContent } from './profile.schema'

export type ProfileVersion = {
  id: string
  createdAt: string
  isCurrent: boolean
  content: ProfileContent
}

export type CurrentProfile = ProfileVersion & { termNames: Record<string, string> }

export async function fetchProfile() {
  const { data } = await api.get<{ profile: CurrentProfile | null }>('/candidate/profile')
  return data.profile
}

export async function saveProfileRequest(content: ProfileContent) {
  const { data } = await api.put<{ profile: ProfileVersion }>('/candidate/profile', content)
  return data.profile
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
