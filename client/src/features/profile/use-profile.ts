import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MATCH_KEY } from '@/features/matching/use-matching'
import {
  fetchPhotoDataUrl,
  fetchPhotoInfo,
  fetchProfile,
  fetchVersions,
  removePhotoRequest,
  restoreVersionRequest,
  saveProfileRequest,
  uploadPhotoRequest,
} from './profile.api'

export const PROFILE_KEY = ['profile'] as const
export const VERSIONS_KEY = ['profile', 'versions'] as const

// No focus refetch: a reload would reset the form and drop unsaved edits.
export const useProfile = () =>
  useQuery({ queryKey: PROFILE_KEY, queryFn: fetchProfile, refetchOnWindowFocus: false })

export const useVersions = () => useQuery({ queryKey: VERSIONS_KEY, queryFn: fetchVersions })

function useRefreshProfile() {
  const queryClient = useQueryClient()
  // Prefix match refreshes both the current profile and the version list. Match scores depend on
  // the profile, so they refresh too.
  // Returned so a mutation waits for the refetch: callers can then rely on fresh data.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
      queryClient.invalidateQueries({ queryKey: MATCH_KEY }),
    ])
}

export const PHOTO_KEY = [...PROFILE_KEY, 'photo'] as const

export const usePhotoUrl = () => useQuery({ queryKey: PHOTO_KEY, queryFn: fetchPhotoInfo })

/** The current photo as a data URL (undefined while loading or when there is none). */
export const usePhotoDataUrl = (photoUrl: string | null | undefined) =>
  useQuery({
    queryKey: [...PHOTO_KEY, 'data', photoUrl],
    queryFn: () => fetchPhotoDataUrl(photoUrl!),
    enabled: !!photoUrl,
    staleTime: Infinity, // the URL carries the content hash
  })

export function useUploadPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadPhotoRequest,
    onSuccess: (photoUrl) => queryClient.setQueryData(PHOTO_KEY, photoUrl),
  })
}

export function useRemovePhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removePhotoRequest,
    onSuccess: () => queryClient.setQueryData(PHOTO_KEY, null),
  })
}

export function useSaveProfile() {
  const refresh = useRefreshProfile()
  return useMutation({ mutationFn: saveProfileRequest, onSuccess: refresh })
}

export function useRestoreVersion() {
  const refresh = useRefreshProfile()
  return useMutation({ mutationFn: restoreVersionRequest, onSuccess: refresh })
}
