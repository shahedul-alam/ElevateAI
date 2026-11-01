import { expect, test } from 'bun:test'
import { hashContent } from '../../lib/content-hash'
import { canonicalizeProfile } from './candidate-profile.canonical'
import {
  contactSchema,
  emptyContact,
  parseStoredContact,
  profileContentSchema,
  profileSaveSchema,
} from './candidate-profile.schema'

const resume = { skills: [], roles: [], leadershipLevel: 0, certIds: [] }

test('an empty contact is valid and every field defaults to empty', () => {
  expect(contactSchema.parse({})).toEqual(emptyContact)
  expect(emptyContact.phone).toBe('')
  expect(emptyContact.linkedin).toBe('')
})

test('accepts a normal contact', () => {
  const parsed = contactSchema.parse({
    phone: '+880 1712-345678',
    email: 'me@example.com',
    city: 'Dhaka',
    country: 'Bangladesh',
    linkedin: 'https://www.linkedin.com/in/someone',
    github: 'https://github.com/someone',
    website: 'http://example.com',
  })
  expect(parsed.phone).toBe('+880 1712-345678')
  expect(parsed.website).toBe('http://example.com')
})

test('rejects links that are not http(s), so they can never be rendered as scripts', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com', 'example.com', 'not a url']) {
    expect(() => contactSchema.parse({ website: bad })).toThrow()
    expect(() => contactSchema.parse({ linkedin: bad })).toThrow()
  }
})

test('rejects malformed phone numbers and emails', () => {
  expect(() => contactSchema.parse({ phone: 'call me maybe' })).toThrow()
  expect(() => contactSchema.parse({ phone: '12' })).toThrow()
  expect(() => contactSchema.parse({ email: 'not-an-email' })).toThrow()
})

test('rejects over-length values', () => {
  expect(() => contactSchema.parse({ city: 'x'.repeat(81) })).toThrow()
  expect(() => contactSchema.parse({ website: `https://example.com/${'a'.repeat(200)}` })).toThrow()
})

test('stored contact that no longer validates reads as empty instead of leaking', () => {
  expect(parseStoredContact({ website: 'javascript:alert(1)', phone: '+1 555 0100' })).toEqual(emptyContact)
  expect(parseStoredContact(null)).toEqual(emptyContact)
  expect(parseStoredContact(undefined)).toEqual(emptyContact)
})

test('contact is optional on save, so resume-only requests cannot wipe it', () => {
  expect(profileSaveSchema.parse(resume).contact).toBeUndefined()
  expect(profileSaveSchema.parse({ ...resume, contact: { phone: '+1 555 0100' } }).contact?.phone).toBe(
    '+1 555 0100',
  )
})

test('contact is not part of the versioned content, so it can never change a version hash', () => {
  const withContact = profileSaveSchema.parse({ ...resume, contact: { phone: '+1 555 0100' } })
  const { contact: _contact, ...content } = withContact
  const plain = profileContentSchema.parse(resume)
  expect(hashContent(canonicalizeProfile(content))).toBe(hashContent(canonicalizeProfile(plain)))
  expect(Object.keys(canonicalizeProfile(content))).not.toContain('contact')
})
