import { expect, test } from 'bun:test'
import { employerApplicationsQuerySchema, noteSchema, ratingSchema } from './applications.schema'

test('rating accepts 1-5 and null, rejects the rest', () => {
  for (const rating of [1, 5, null]) expect(ratingSchema.safeParse({ rating }).success).toBe(true)
  for (const rating of [0, 6, 2.5, '3']) expect(ratingSchema.safeParse({ rating }).success).toBe(false)
})

test('note is trimmed and must be 1-2000 chars', () => {
  expect(noteSchema.parse({ body: '  hi  ' }).body).toBe('hi')
  expect(noteSchema.safeParse({ body: '   ' }).success).toBe(false)
  expect(noteSchema.safeParse({ body: 'x'.repeat(2001) }).success).toBe(false)
})

test('employer applications query treats blanks as unset and rejects bad values', () => {
  const ok = employerApplicationsQuerySchema.parse({ status: '', jobId: '', q: '', minRating: '3' })
  expect(ok).toMatchObject({ status: undefined, jobId: undefined, minRating: 3, limit: 20 })
  expect(employerApplicationsQuerySchema.safeParse({ status: 'nope' }).success).toBe(false)
  expect(employerApplicationsQuerySchema.safeParse({ minRating: '6' }).success).toBe(false)
  expect(employerApplicationsQuerySchema.safeParse({ jobId: 'abc' }).success).toBe(false)
})
