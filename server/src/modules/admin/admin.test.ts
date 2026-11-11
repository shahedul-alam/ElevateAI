import { expect, test } from 'bun:test'
import { moderationMessage } from '../notifications/notifications.messages'
import { adminJobsQuerySchema, adminUsersQuerySchema, suspensionSchema } from './admin.schema'

test('a suspension needs a real reason', () => {
  expect(suspensionSchema.safeParse({}).success).toBe(false)
  expect(suspensionSchema.safeParse({ reason: '  ab ' }).success).toBe(false)
  expect(suspensionSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false)
  expect(suspensionSchema.parse({ reason: '  Spam listing ' }).reason).toBe('Spam listing')
})

test('list queries parse the suspended flag and bound the page size', () => {
  expect(adminUsersQuerySchema.parse({ suspended: 'true' }).suspended).toBe(true)
  expect(adminUsersQuerySchema.parse({ suspended: 'false' }).suspended).toBe(false)
  expect(adminUsersQuerySchema.parse({}).suspended).toBeUndefined()
  expect(adminUsersQuerySchema.safeParse({ suspended: 'yes' }).success).toBe(false)
  expect(adminUsersQuerySchema.safeParse({ role: 'owner' }).success).toBe(false)
  expect(adminJobsQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
  expect(adminJobsQuerySchema.safeParse({ cursor: 'x' }).success).toBe(false)
})

test('moderation messages name the job and carry the reason', () => {
  const s = moderationMessage('suspended', 'Dev', 'Spam')
  expect(s.title).toBe('Job suspended: Dev')
  expect(s.body).toContain('Reason: Spam')
  expect(moderationMessage('restored', 'Dev').title).toBe('Job restored: Dev')
})
