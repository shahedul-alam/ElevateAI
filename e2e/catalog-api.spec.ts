import { expect, test } from '@playwright/test'

test.describe('catalog API', () => {
  test('finds a term by alias', async ({ request }) => {
    const res = await request.get('/api/catalog', { params: { kind: 'skill', q: 'react.js' } })
    expect(res.status()).toBe(200)
    const { terms } = await res.json()
    expect(terms).toContainEqual({ id: 'skill:react', name: 'React' })
  })

  test('finds a term by partial name, case-insensitively', async ({ request }) => {
    const res = await request.get('/api/catalog', { params: { kind: 'certification', q: 'AWS' } })
    const { terms } = await res.json()
    expect(terms.map((t: { id: string }) => t.id)).toContain('certification:aws-developer')
  })

  test('does not return terms of another kind', async ({ request }) => {
    const res = await request.get('/api/catalog', { params: { kind: 'domain', q: 'react' } })
    expect((await res.json()).terms).toEqual([])
  })

  test('rejects an invalid kind', async ({ request }) => {
    const res = await request.get('/api/catalog', { params: { kind: 'nonsense', q: 'react' } })
    expect(res.status()).toBe(400)
  })

  test('rejects a missing kind', async ({ request }) => {
    expect((await request.get('/api/catalog')).status()).toBe(400)
  })
})
