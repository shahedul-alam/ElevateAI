import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { explainGapRequest, fetchGap, fetchGapExplanation, fetchRecommended } from './matching.api'

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

// Under the matching prefix, so a profile, job or application change refetches it for the new versions.
export const useGapExplanation = (jobId: string, enabled: boolean) =>
  useQuery({
    queryKey: [...MATCH_KEY, 'gap-explanation', jobId],
    queryFn: () => fetchGapExplanation(jobId),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })

export function useExplainGap(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => explainGapRequest(jobId),
    onSuccess: (data) => queryClient.setQueryData([...MATCH_KEY, 'gap-explanation', jobId], data),
  })
}
