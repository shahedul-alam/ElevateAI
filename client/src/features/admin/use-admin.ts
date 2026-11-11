import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { JOBS_KEY } from '@/features/jobs/use-jobs'

import {
  deleteUserRequest,
  fetchAdminJobs,
  fetchAudit,
  fetchAdminUsers,
  fetchOverview,
  restoreJobRequest,
  restoreUserRequest,
  suspendJobRequest,
  suspendUserRequest,
  type AdminListFilters,
  type AuditFilter,
  type JobFilter,
  type UserFilter,
} from './admin.api'

export const ADMIN_KEY = ['admin'] as const

export const useOverview = () => useQuery({ queryKey: [...ADMIN_KEY, 'overview'], queryFn: fetchOverview })

export const useAdminUsers = (filters: AdminListFilters<UserFilter>) =>
  useInfiniteQuery({
    queryKey: [...ADMIN_KEY, 'users', filters],
    queryFn: ({ pageParam }) => fetchAdminUsers(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

export const useAuditLog = (filters: AdminListFilters<AuditFilter>) =>
  useInfiniteQuery({
    queryKey: [...ADMIN_KEY, 'audit', filters],
    queryFn: ({ pageParam }) => fetchAudit(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

export const useAdminJobs = (filters: AdminListFilters<JobFilter>) =>
  useInfiniteQuery({
    queryKey: [...ADMIN_KEY, 'jobs', filters],
    queryFn: ({ pageParam }) => fetchAdminJobs(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

// Every moderation change refreshes the admin lists and counts; job changes also refresh public job lists.
function useModeration<V, R>(fn: (v: V) => Promise<R>, jobs: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY })
      if (jobs) queryClient.invalidateQueries({ queryKey: JOBS_KEY })
    },
  })
}

export const useSuspendUser = () => useModeration(suspendUserRequest, false)
export const useRestoreUser = () => useModeration(restoreUserRequest, false)
export const useSuspendJob = () => useModeration(suspendJobRequest, true)
export const useRestoreJob = () => useModeration(restoreJobRequest, true)
export const useDeleteUser = () => useModeration(deleteUserRequest, true)
