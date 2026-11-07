import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/auth.store'
import { MATCH_KEY } from '@/features/matching/use-matching'
import {
  addNoteRequest,
  applyRequest,
  changeApplicationStatusRequest,
  deleteNoteRequest,
  fetchActivity,
  fetchApplicants,
  fetchEmployerApplications,
  fetchMyApplications,
  setRatingRequest,
  type EmployerApplicationFilters,
} from './applications.api'

export const APPLICATIONS_KEY = ['applications'] as const

export const useMyApplications = () =>
  useQuery({ queryKey: [...APPLICATIONS_KEY, 'mine'], queryFn: fetchMyApplications })

// Summaries are written in the background after applying: poll briefly (about a minute) while any is missing.
const SUMMARY_POLL_MS = 5_000
const SUMMARY_POLL_MAX = 12
const pollWhileSummaryMissing = (query: {
  state: { data?: { pages: { applicants: { summary: string | null }[] }[] }; dataUpdateCount: number }
}) =>
  query.state.data?.pages.some((p) => p.applicants.some((a) => a.summary === null)) &&
  query.state.dataUpdateCount < SUMMARY_POLL_MAX
    ? SUMMARY_POLL_MS
    : false

export const useApplicants = (jobId: string) =>
  useInfiniteQuery({
    refetchInterval: pollWhileSummaryMissing,
    queryKey: [...APPLICATIONS_KEY, 'job', jobId],
    queryFn: ({ pageParam }) => fetchApplicants(jobId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  })

export const useEmployerApplications = (filters: EmployerApplicationFilters) => {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  return useInfiniteQuery({
    queryKey: [...APPLICATIONS_KEY, 'employer', userId, filters],
    refetchInterval: pollWhileSummaryMissing,
    queryFn: ({ pageParam }) => fetchEmployerApplications(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
    // Keep the old list on screen while a filter change loads, so typing does not flash.
    placeholderData: (prev) => prev,
  })
}

export const useApplicationActivity = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: [...APPLICATIONS_KEY, 'activity', id],
    queryFn: () => fetchActivity(id),
    enabled,
    retry: false,
  })

/** Notes and ratings change the list (note count, stars) and the open activity sheet. */
function useApplicationMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY }),
  })
}

export const useAddNote = () => useApplicationMutation(addNoteRequest)
export const useDeleteNote = () => useApplicationMutation(deleteNoteRequest)
export const useSetRating = () => useApplicationMutation(setRatingRequest)

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
