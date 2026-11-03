import { expect, setSystemTime, test } from 'bun:test'
import { detectImageType } from './company.images'
import { companySaveSchema, identityChanged, readAwards, readLines, readLinks } from './company.schema'

const parse = (raw: unknown) => companySaveSchema.parse(raw)

test('only a name is required and everything else defaults to empty', () => {
  const c = parse({ name: 'Acme' })
  expect(c.tagline).toBe('')
  expect(c.benefits).toEqual([])
  expect(c.links).toEqual({ linkedin: '', github: '', x: '' })
  expect(c.domainId).toBeNull()
  expect(() => parse({ name: '  ' })).toThrow()
})

test('verified can never be set through the employer payload', () => {
  const c = parse({ name: 'Acme', verified: true }) as Record<string, unknown>
  expect(c).not.toHaveProperty('verified')
})

test('links must be http(s)', () => {
  expect(() => parse({ name: 'A', website: 'javascript:alert(1)' })).toThrow()
  expect(() => parse({ name: 'A', links: { linkedin: 'data:text/html,hi' } })).toThrow()
  expect(parse({ name: 'A', website: 'https://acme.test' }).website).toBe('https://acme.test')
})

test('year and list limits are enforced', () => {
  expect(() => parse({ name: 'A', foundedYear: 1700 })).toThrow()
  expect(() => parse({ name: 'A', foundedYear: new Date().getFullYear() + 1 })).toThrow()
  expect(() => parse({ name: 'A', benefits: Array(21).fill('x') })).toThrow()
  expect(() => parse({ name: 'A', benefits: ['  '] })).toThrow()
  expect(() => parse({ name: 'A', culture: Array(9).fill({ title: 't' }) })).toThrow()
  expect(() => parse({ name: 'A', awards: [{ title: '', year: 2020 }] })).toThrow()
  expect(() => parse({ name: 'A', size: '5 people' })).toThrow()
  expect(() => parse({ name: 'A', domainId: 'skill:react' })).toThrow()
  expect(() => parse({ name: 'A', workPolicy: 'sometimes' })).toThrow()
})

test('stored JSON that no longer validates reads back as empty', () => {
  expect(readLinks({ linkedin: 'javascript:x' })).toEqual({ linkedin: '', github: '', x: '' })
  expect(readLines('nope')).toEqual([])
  expect(readAwards([{ title: 'ok' }])).toEqual([{ title: 'ok', issuer: '', year: null }])
})

test('image type comes from the bytes, not from what the client claims', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])
  expect(detectImageType(png)).toBe('image/png')
  expect(detectImageType(jpeg)).toBe('image/jpeg')
  expect(detectImageType(webp)).toBe('image/webp')
  expect(detectImageType(Buffer.from('<svg onload=alert(1)>'))).toBeNull()
  expect(detectImageType(Buffer.from('GIF89a'))).toBeNull()
  expect(detectImageType(Buffer.alloc(0))).toBeNull()
})

test('changing name, website or links counts as an identity change; other edits do not', () => {
  const current = { name: 'Acme', website: 'https://acme.test', links: { linkedin: 'https://l.test/acme', github: '', x: '' } }
  const same = { name: 'Acme', website: 'https://acme.test', links: { linkedin: 'https://l.test/acme', github: '', x: '' } }
  expect(identityChanged(current, same)).toBe(false)
  expect(identityChanged(current, { ...same, name: ' Acme ' })).toBe(false)
  expect(identityChanged(current, { ...same, name: 'Google' })).toBe(true)
  expect(identityChanged(current, { ...same, website: 'https://evil.test' })).toBe(true)
  expect(identityChanged(current, { ...same, links: { ...same.links, x: 'https://x.com/acme' } })).toBe(true)
  expect(identityChanged({ ...current, links: 'garbage' }, same)).toBe(true)
})

test('the year limits follow the clock at request time, not server start', () => {
  try {
    setSystemTime(new Date('2030-06-01T12:00:00Z'))
    expect(parse({ name: 'A', foundedYear: 2030 }).foundedYear).toBe(2030)
    expect(parse({ name: 'A', awards: [{ title: 'Best', year: 2030 }] }).awards[0]!.year).toBe(2030)
    expect(() => parse({ name: 'A', foundedYear: 2031 })).toThrow()
    setSystemTime(new Date('2026-06-01T12:00:00Z'))
    expect(() => parse({ name: 'A', foundedYear: 2030 })).toThrow()
    expect(() => parse({ name: 'A', awards: [{ title: 'Best', year: 2030 }] })).toThrow()
  } finally {
    setSystemTime()
  }
})
