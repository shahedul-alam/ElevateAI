import { api } from '@/lib/api'

export type AppNotification = {
  id: string
  type: 'application_status' | 'application_received' | 'moderation'
  title: string
  body: string
  /** An internal path built by the server. */
  link: string
  readAt: string | null
  createdAt: string
}

export async function fetchUnreadCount() {
  const { data } = await api.get<{ unreadCount: number }>('/notifications/unread-count')
  return data.unreadCount
}

export async function fetchNotifications(cursor?: string) {
  const { data } = await api.get<{
    notifications: AppNotification[]
    nextCursor: string | null
    unreadCount: number
  }>('/notifications', { params: cursor ? { cursor } : {} })
  return data
}

export const markReadRequest = (id: string) => api.post(`/notifications/${id}/read`)

export const markAllReadRequest = () => api.post('/notifications/read-all')

export const deleteNotificationRequest = (id: string) => api.delete(`/notifications/${id}`)

export const clearNotificationsRequest = () => api.delete('/notifications')
