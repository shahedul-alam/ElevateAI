import { expect, type APIRequestContext } from '@playwright/test'

export type NotificationDto = {
  id: string
  type: 'application_status' | 'application_received'
  title: string
  body: string
  link: string
  readAt: string | null
  createdAt: string
}

export async function listNotifications(request: APIRequestContext, params: Record<string, string> = {}) {
  const res = await request.get('/api/notifications', { params })
  expect(res.status(), await res.text()).toBe(200)
  return (await res.json()) as { notifications: NotificationDto[]; nextCursor: string | null; unreadCount: number }
}

export async function unreadCountApi(request: APIRequestContext) {
  const res = await request.get('/api/notifications/unread-count')
  expect(res.status(), await res.text()).toBe(200)
  return ((await res.json()) as { unreadCount: number }).unreadCount
}

export const markReadApi = (request: APIRequestContext, id: string) => request.post(`/api/notifications/${id}/read`)

export const markAllReadApi = (request: APIRequestContext) => request.post('/api/notifications/read-all')
