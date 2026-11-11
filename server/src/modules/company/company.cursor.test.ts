import { expect, test } from 'bun:test'
import { afterPosition, decodeCursor, encodeCursor } from './company.cursor'

const id = '0c287ecc-13f5-471b-90cb-db72d3ef2080'

test('a cursor round-trips the sort position of the last row', () => {
  const cursor = encodeCursor({ verified: true, name: 'Acme "Ltd" é', id })
  expect(decodeCursor(cursor)).toEqual({ v: true, n: 'Acme "Ltd" é', i: id })
})

test('anything the server did not issue decodes to null', () => {
  expect(decodeCursor('')).toBeNull()
  expect(decodeCursor('not base64 json')).toBeNull()
  expect(decodeCursor(id)).toBeNull()
  expect(decodeCursor(Buffer.from('{"v":"yes","n":1,"i":2}').toString('base64url'))).toBeNull()
  expect(decodeCursor(Buffer.from('{"v":true,"n":"A","i":"nope"}').toString('base64url'))).toBeNull()
})

test('after a verified row come unverified rows and later verified ones', () => {
  const where = afterPosition({ v: true, n: 'Beta', i: id }) as { OR: object[] }
  expect(where.OR).toEqual([
    { verified: false },
    { verified: true, name: { gt: 'Beta' } },
    { verified: true, name: 'Beta', id: { gt: id } },
  ])
})

test('after an unverified row only later unverified rows remain', () => {
  const where = afterPosition({ v: false, n: 'Beta', i: id }) as { OR: object[] }
  expect(where.OR).toEqual([
    { verified: false, name: { gt: 'Beta' } },
    { verified: false, name: 'Beta', id: { gt: id } },
  ])
})
