import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { MATCH_KEY } from '@/features/matching/use-matching'
import {
  changeJobStatusRequest,
  createJobRequest,
  draftJobRequest,
  fetchJob,
  fetchJobs,
  fetchMyJob,
  fetchMyJobs,
  updateJobRequest,
  type JobListFilters,
} from './jobs.api'

// Employer-side and public queries share the 'jobs' prefix so one invalidation refreshes both.
export const JOBS_KEY = ['jobs'] as const

export const usePublicJobs = (filters: JobListFilters) =>
  useInfiniteQuery({
    queryKey: [...JOBS_KEY, 'public', filters],
    queryFn: ({ pageParam }) => fetchJobs(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

export const usePublicJob = (id: string) =>
  useQuery({ queryKey: [...JOBS_KEY, 'public', id], queryFn: () => fetchJob(id), retry: false })

// Nothing is cached or invalidated: the result only fills the form until the employer saves.
export const useDraftJob = () => useMutation({ mutationFn: draftJobRequest })

export const useMyJobs =() => useQuery({ queryKey: [...JOBS_KEY, 'mine'], queryFn: fetchMyJobs })

// No focus refetch: a reload would reset the edit form and drop unsaved changes.
export const useMyJob = (id: string | undefined) =>
  useQuery({
    queryKey: [...JOBS_KEY, 'mine', id],
    queryFn: () => fetchMyJob(id!),
    enabled: !!id,
    retry: false,
    refetchOnWindowFocus: false,
  })

function useRefreshJobs() {
  const queryClient = useQueryClient()
  // Gap views and recommendations score against the job's requirements, so they refresh too.
  return () => {
    queryClient.invalidateQueries({ queryKey: JOBS_KEY })
    queryClient.invalidateQueries({ queryKey: MATCH_KEY })
  }
}

export function useCreateJob() {
  const refresh = useRefreshJobs()
  return useMutation({ mutationFn: createJobRequest, onSuccess: refresh })
}

export function useUpdateJob() {
  const refresh = useRefreshJobs()
  return useMutation({ mutationFn: updateJobRequest, onSuccess: refresh })
}

export function useChangeJobStatus() {
  const refresh = useRefreshJobs()
  return useMutation({ mutationFn: changeJobStatusRequest, onSuccess: refresh })
}
