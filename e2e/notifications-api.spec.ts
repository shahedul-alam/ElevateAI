import { expect, test } from '@playwright/test'
import { MISSING_ID, newEmployer, publishReactJob, reactProfile, setStatus } from './support/matching'
import { applyCandidate } from './support/hiring'
import { uniqueTitle } from './support/jobs'
import {
  clearNotificationsApi,
  deleteNotificationApi,
  listNotifications,
  markAllReadApi,
  markReadApi,
  unreadCountApi,
} from './support/notifications'

/** A candidate with `moves` status notifications (the first stage move is under_review, then technical_interview, ...). */
async function candidateWithNotifications(playwright: Parameters<typeof newEmployer>[0], baseURL: string | undefined, moves: number) {
  const employer = await newEmployer(playwright, baseURL)
  const job = await publishReactJob(employer.ctx, 4)
  const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
  for (const status of ['under_review', 'technical_interview', 'culture_fit', 'offer'].slice(0, moves)) {
    expect((await setStatus(employer.ctx, ada.applicationId, status)).status()).toBe(200)
  }
  return { employer, ada, job }
}

test.describe('notifications API access', () => {
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    expect((await request.get('/api/notifications')).status()).toBe(401)
    expect((await request.get('/api/notifications/unread-count')).status()).toBe(401)
    expect((await request.post('/api/notifications/read-all')).status()).toBe(401)
    expect((await request.post(`/api/notifications/${MISSING_ID}/read`)).status()).toBe(401)
    expect((await deleteNotificationApi(request, MISSING_ID)).status()).toBe(401)
    expect((await clearNotificationsApi(request)).status()).toBe(401)
  })

  test('starts empty for a new user', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    expect(await listNotifications(employer.ctx)).toEqual({ notifications: [], nextCursor: null, unreadCount: 0 })
    expect(await unreadCountApi(employer.ctx)).toBe(0)
    await employer.ctx.dispose()
  })
})

test.describe('application received (employer)', () => {
  test('notifies the employer once, with the candidate, job and score', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const title = uniqueTitle('Notify')
    const job = await publishReactJob(employer.ctx, 4, { title })
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    const { notifications, unreadCount } = await listNotifications(employer.ctx)
    expect(unreadCount).toBe(1)
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      type: 'application_received',
      title: `New application: ${title}`,
      body: `Ada Lovelace applied to ${title} (75% match).`,
      link: `/employer/hiring?job=${job.id}`,
      readAt: null,
    })
    // The candidate is not told about their own application.
    expect((await listNotifications(ada.ctx)).notifications).toHaveLength(0)

    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test('a second apply to the same job (409) adds nothing', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    expect((await ada.ctx.post(`/api/jobs/${job.id}/apply`)).status()).toBe(409)
    expect(await unreadCountApi(employer.ctx)).toBe(1)
    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test("only the job's own employer is notified", async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const other = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    expect(await unreadCountApi(employer.ctx)).toBe(1)
    expect(await unreadCountApi(other.ctx)).toBe(0)
    await Promise.all([employer.ctx.dispose(), other.ctx.dispose(), ada.ctx.dispose()])
  })
})

test.describe('status change (candidate)', () => {
  test('one notification per move, newest first, linking to /applications', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const title = uniqueTitle('Stages')
    const job = await publishReactJob(employer.ctx, 4, { title })
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))

    for (const status of ['under_review', 'technical_interview', 'culture_fit', 'offer', 'hired']) {
      expect((await setStatus(employer.ctx, ada.applicationId, status)).status()).toBe(200)
    }
    const { notifications, unreadCount } = await listNotifications(ada.ctx)
    expect(unreadCount).toBe(5)
    expect(notifications.map((n) => n.title)).toEqual([
      `You were hired: ${title}`,
      `Offer: ${title}`,
      `Culture fit: ${title}`,
      `Technical interview: ${title}`,
      `Under review: ${title}`,
    ])
    for (const n of notifications) {
      expect(n.type).toBe('application_status')
      expect(n.link).toBe('/applications')
      expect(n.body).toContain(title)
    }
    expect(notifications[3]!.body).toMatch(/^Your application for .+ moved to technical interview\.$/)

    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test('rejection is worded neutrally and names no rating or note', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const title = uniqueTitle('Neutral')
    const job = await publishReactJob(employer.ctx, 4, { title })
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    await employer.ctx.patch(`/api/employer/applications/${ada.applicationId}/rating`, { data: { rating: 1 } })
    await employer.ctx.post(`/api/employer/applications/${ada.applicationId}/notes`, { data: { body: 'private' } })
    expect((await setStatus(employer.ctx, ada.applicationId, 'rejected')).status()).toBe(200)

    const [n] = (await listNotifications(ada.ctx)).notifications
    expect(n!.title).toBe(`Update on your application for ${title}`)
    expect(n!.body.toLowerCase()).not.toContain('reject')
    expect(JSON.stringify(n)).not.toContain('private')
    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test('failed moves create nothing and do not reach the employer', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    await setStatus(employer.ctx, ada.applicationId, 'offer')
    expect(await unreadCountApi(ada.ctx)).toBe(1)

    expect((await setStatus(employer.ctx, ada.applicationId, 'under_review')).status()).toBe(409) // backwards
    expect((await setStatus(employer.ctx, ada.applicationId, 'offer')).status()).toBe(409) // same stage
    expect((await setStatus(employer.ctx, ada.applicationId, 'applied')).status()).toBe(400)
    expect((await setStatus(employer.ctx, MISSING_ID, 'offer')).status()).toBe(404)
    expect(await unreadCountApi(ada.ctx)).toBe(1)
    // The employer only has the "new application" entry, not the candidate's stage notifications.
    expect(await unreadCountApi(employer.ctx)).toBe(1)

    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test("another employer's move is refused and notifies nobody", async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const stranger = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    expect((await setStatus(stranger.ctx, ada.applicationId, 'offer')).status()).toBe(404)
    expect(await unreadCountApi(ada.ctx)).toBe(0)
    await Promise.all([employer.ctx.dispose(), stranger.ctx.dispose(), ada.ctx.dispose()])
  })
})

test.describe('reading and paging', () => {
  test('lists with a cursor and no duplicates, and validates the query', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    for (const status of ['under_review', 'technical_interview', 'culture_fit']) {
      await setStatus(employer.ctx, ada.applicationId, status)
    }

    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page = await listNotifications(ada.ctx, { limit: '2', ...(cursor && { cursor }) })
      expect(page.unreadCount).toBe(3)
      seen.push(...page.notifications.map((n) => n.id))
      cursor = page.nextCursor
      pages++
    } while (cursor)
    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(3)
    expect(pages).toBe(2)

    for (const bad of [{ limit: '0' }, { limit: '51' }, { limit: 'x' }, { cursor: 'nope' }]) {
      expect((await ada.ctx.get('/api/notifications', { params: bad })).status()).toBe(400)
    }
    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test('marks one read (idempotently) and all read', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    await setStatus(employer.ctx, ada.applicationId, 'under_review')
    await setStatus(employer.ctx, ada.applicationId, 'offer')

    const [newest, older] = (await listNotifications(ada.ctx)).notifications
    expect((await markReadApi(ada.ctx, newest!.id)).status()).toBe(204)
    expect(await unreadCountApi(ada.ctx)).toBe(1)
    const read = (await listNotifications(ada.ctx)).notifications.find((n) => n.id === newest!.id)
    expect(read!.readAt).not.toBeNull()
    // Reading again keeps the first read time and the count.
    expect((await markReadApi(ada.ctx, newest!.id)).status()).toBe(204)
    expect((await listNotifications(ada.ctx)).notifications.find((n) => n.id === newest!.id)!.readAt).toBe(read!.readAt)
    expect(await unreadCountApi(ada.ctx)).toBe(1)

    expect((await markAllReadApi(ada.ctx)).status()).toBe(204)
    expect(await unreadCountApi(ada.ctx)).toBe(0)
    expect(older!.id).toBeTruthy()
    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })

  test("cannot read or mark someone else's notifications", async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', job.id, reactProfile(4))
    await setStatus(employer.ctx, ada.applicationId, 'offer')

    const [adas] = (await listNotifications(ada.ctx)).notifications
    expect((await markReadApi(grace.ctx, adas!.id)).status()).toBe(404)
    expect((await markReadApi(employer.ctx, adas!.id)).status()).toBe(404)
    expect((await markReadApi(ada.ctx, MISSING_ID)).status()).toBe(404)
    expect((await markReadApi(ada.ctx, 'not-a-uuid')).status()).toBe(404)
    expect(await unreadCountApi(ada.ctx)).toBe(1)

    // read-all only touches the caller's own entries.
    await markAllReadApi(grace.ctx)
    expect(await unreadCountApi(ada.ctx)).toBe(1)
    expect((await listNotifications(grace.ctx)).notifications).toHaveLength(0)
    await Promise.all([employer.ctx.dispose(), ada.ctx.dispose(), grace.ctx.dispose()])
  })

  test('applying to a missing job fails and notifies nobody', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    const job = await publishReactJob(employer.ctx, 4)
    const ada = await applyCandidate(playwright, baseURL, 'Ada Lovelace', job.id, reactProfile(3))
    expect((await ada.ctx.post(`/api/jobs/${MISSING_ID}/apply`)).status()).toBe(404)
    expect(await unreadCountApi(employer.ctx)).toBe(1)
    await employer.ctx.dispose()
    await ada.ctx.dispose()
  })
})

test.describe('deleting notifications', () => {
  test('deletes an unread one (204), updates the count, and a repeat is 404', async ({ playwright, baseURL }) => {
    const { employer, ada } = await candidateWithNotifications(playwright, baseURL, 3)
    const { notifications } = await listNotifications(ada.ctx)
    expect(await unreadCountApi(ada.ctx)).toBe(3)

    expect((await deleteNotificationApi(ada.ctx, notifications[0]!.id)).status()).toBe(204)
    const after = await listNotifications(ada.ctx)
    expect(after.notifications.map((n) => n.id)).toEqual([notifications[1]!.id, notifications[2]!.id])
    expect(after.unreadCount).toBe(2)

    const again = await deleteNotificationApi(ada.ctx, notifications[0]!.id)
    expect(again.status()).toBe(404)
    expect((await again.json()).error.message).toBe('Notification not found')
    await Promise.all([employer.ctx.dispose(), ada.ctx.dispose()])
  })

  test('deleting a read one leaves the unread count unchanged', async ({ playwright, baseURL }) => {
    const { employer, ada } = await candidateWithNotifications(playwright, baseURL, 2)
    const [newest] = (await listNotifications(ada.ctx)).notifications
    await markReadApi(ada.ctx, newest!.id)
    expect(await unreadCountApi(ada.ctx)).toBe(1)

    expect((await deleteNotificationApi(ada.ctx, newest!.id)).status()).toBe(204)
    expect(await unreadCountApi(ada.ctx)).toBe(1)
    expect((await listNotifications(ada.ctx)).notifications).toHaveLength(1)
    await Promise.all([employer.ctx.dispose(), ada.ctx.dispose()])
  })

  test("cannot delete someone else's notification, a missing one or a malformed id", async ({ playwright, baseURL }) => {
    const { employer, ada, job } = await candidateWithNotifications(playwright, baseURL, 1)
    const grace = await applyCandidate(playwright, baseURL, 'Grace Hopper', job.id, reactProfile(4))
    const [adas] = (await listNotifications(ada.ctx)).notifications

    expect((await deleteNotificationApi(grace.ctx, adas!.id)).status()).toBe(404)
    expect((await deleteNotificationApi(employer.ctx, adas!.id)).status()).toBe(404)
    expect((await deleteNotificationApi(ada.ctx, MISSING_ID)).status()).toBe(404)
    expect((await deleteNotificationApi(ada.ctx, 'not-a-uuid')).status()).toBe(404)
    expect((await listNotifications(ada.ctx)).notifications.map((n) => n.id)).toEqual([adas!.id])
    await Promise.all([employer.ctx.dispose(), ada.ctx.dispose(), grace.ctx.dispose()])
  })

  test('paging stays consistent after a delete', async ({ playwright, baseURL }) => {
    const { employer, ada } = await candidateWithNotifications(playwright, baseURL, 4)
    const all = (await listNotifications(ada.ctx)).notifications
    expect(all).toHaveLength(4)

    const firstPage = await listNotifications(ada.ctx, { limit: '2' })
    expect(firstPage.notifications.map((n) => n.id)).toEqual([all[0]!.id, all[1]!.id])
    expect((await deleteNotificationApi(ada.ctx, firstPage.notifications[0]!.id)).status()).toBe(204)

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page = await listNotifications(ada.ctx, { limit: '2', ...(cursor && { cursor }) })
      seen.push(...page.notifications.map((n) => n.id))
      cursor = page.nextCursor
    } while (cursor)
    expect(seen).toEqual([all[1]!.id, all[2]!.id, all[3]!.id])
    await Promise.all([employer.ctx.dispose(), ada.ctx.dispose()])
  })
})

test.describe('clearing notifications', () => {
  test("removes all of the caller's notifications and nobody else's", async ({ playwright, baseURL }) => {
    const { employer, ada } = await candidateWithNotifications(playwright, baseURL, 3)
    // The employer also holds one ("new application") that must survive Ada clearing hers.
    expect(await unreadCountApi(employer.ctx)).toBe(1)
    expect((await listNotifications(ada.ctx)).notifications).toHaveLength(3)

    expect((await clearNotificationsApi(ada.ctx)).status()).toBe(204)
    expect(await listNotifications(ada.ctx)).toEqual({ notifications: [], nextCursor: null, unreadCount: 0 })
    expect(await unreadCountApi(employer.ctx)).toBe(1)
    await Promise.all([employer.ctx.dispose(), ada.ctx.dispose()])
  })

  test('clearing an empty inbox is 204', async ({ playwright, baseURL }) => {
    const employer = await newEmployer(playwright, baseURL)
    expect((await clearNotificationsApi(employer.ctx)).status()).toBe(204)
    expect((await clearNotificationsApi(employer.ctx)).status()).toBe(204)
    expect((await listNotifications(employer.ctx)).notifications).toEqual([])
    await employer.ctx.dispose()
  })
})
