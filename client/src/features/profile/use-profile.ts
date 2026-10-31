import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MATCH_KEY } from '@/features/matching/use-matching'
import { fetchProfile, fetchVersions, restoreVersionRequest, saveProfileRequest } from './profile.api'

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
  return () => {
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY })
    queryClient.invalidateQueries({ queryKey: MATCH_KEY })
  }
}

export function useSaveProfile() {
  const refresh = useRefreshProfile()
  return useMutation({ mutationFn: saveProfileRequest, onSuccess: refresh })
}

export function useRestoreVersion() {
  const refresh = useRefreshProfile()
  return useMutation({ mutationFn: restoreVersionRequest, onSuccess: refresh })
}
