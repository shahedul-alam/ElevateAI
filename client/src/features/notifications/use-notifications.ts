import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/auth.store'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllReadRequest,
  markReadRequest,
} from './notifications.api'

export const NOTIFICATIONS_KEY = ['notifications'] as const

/** Polled: a change reaches an open tab within 30 s, or at once when the window regains focus. */
export const POLL_MS = 30_000

export function useUnreadCount() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'count', userId],
    queryFn: fetchUnreadCount,
    enabled: !!userId,
    refetchInterval: POLL_MS, // paused while the tab is hidden
    refetchOnWindowFocus: true,
    retry: false,
  })
}

/** The list is only fetched while the bell is open. */
export function useNotifications(enabled: boolean) {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', userId],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!userId,
    retry: false,
  })
}

function useNotificationMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

export const useMarkRead = () => useNotificationMutation(markReadRequest)
export const useMarkAllRead = () => useNotificationMutation(markAllReadRequest)
