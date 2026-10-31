import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MATCH_KEY } from '@/features/matching/use-matching'
import {
  applyRequest,
  changeApplicationStatusRequest,
  fetchApplicants,
  fetchMyApplications,
} from './applications.api'

export const APPLICATIONS_KEY = ['applications'] as const

export const useMyApplications = () =>
  useQuery({ queryKey: [...APPLICATIONS_KEY, 'mine'], queryFn: fetchMyApplications })

export const useApplicants = (jobId: string) =>
  useInfiniteQuery({
    queryKey: [...APPLICATIONS_KEY, 'job', jobId],
    queryFn: ({ pageParam }) => fetchApplicants(jobId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  })

export function useApply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: applyRequest,
    onSuccess: () => {
      // The gap view shows the application, and recommendations drop jobs already applied to.
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY })
      queryClient.invalidateQueries({ queryKey: MATCH_KEY })
    },
  })
}

export function useChangeApplicationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: changeApplicationStatusRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY }),
  })
}
