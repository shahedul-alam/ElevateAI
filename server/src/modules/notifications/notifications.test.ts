import { expect, test } from 'bun:test'
import { receivedMessage, statusMessage } from './notifications.messages'
import { notificationsQuerySchema } from './notifications.schema'

test('every stage has a message naming the job', () => {
  for (const s of ['applied', 'under_review', 'technical_interview', 'culture_fit', 'offer', 'hired', 'rejected'] as const) {
    const m = statusMessage(s, 'Backend Engineer', 'Acme')
    expect(m.title).toContain('Backend Engineer')
    expect(m.body).toContain('Backend Engineer')
  }
})

test('stage moves read plainly, rejection stays neutral, hiring says so', () => {
  expect(statusMessage('technical_interview', 'Dev', 'Acme').body).toBe(
    'Your application for Dev at Acme moved to technical interview.',
  )
  const rejected = statusMessage('rejected', 'Dev', 'Acme')
  expect(rejected.title).toBe('Update on your application for Dev')
  expect(rejected.body.toLowerCase()).not.toContain('reject')
  expect(statusMessage('hired', 'Dev', 'Acme').title).toStartWith('You were hired')
})

test('company name is optional', () => {
  expect(statusMessage('offer', 'Dev', '').body).toBe('Your application for Dev moved to offer.')
})

test('employer message carries name, job and score', () => {
  expect(receivedMessage('Maria Lopez', 'Dev', 82).body).toBe('Maria Lopez applied to Dev (82% match).')
})

test('list query bounds', () => {
  expect(notificationsQuerySchema.parse({}).limit).toBe(20)
  expect(notificationsQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
  expect(notificationsQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
  expect(notificationsQuerySchema.safeParse({ cursor: 'x' }).success).toBe(false)
})
