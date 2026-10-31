import { useQuery } from '@tanstack/react-query'

import { fetchGap, fetchRecommended } from './matching.api'

// Everything derived from a profile/job pair lives under this prefix, so profile, job and
// application changes can refresh all of it with one invalidation.
export const MATCH_KEY = ['matching'] as const

export const useGap = (jobId: string, enabled: boolean) =>
  useQuery({
    queryKey: [...MATCH_KEY, 'gap', jobId],
    queryFn: () => fetchGap(jobId),
    enabled,
    retry: false,
  })

export const useRecommended = (enabled: boolean) =>
  useQuery({
    queryKey: [...MATCH_KEY, 'recommended'],
    queryFn: () => fetchRecommended(),
    enabled,
    retry: false,
  })
