import { describe, expect, test } from 'bun:test'
import { resolveSocialRole } from './auth.role'

describe('resolveSocialRole', () => {
  test('accepts the two sign-up roles', () => {
    expect(resolveSocialRole('candidate')).toBe('candidate')
    expect(resolveSocialRole('employer')).toBe('employer')
  })

  test('never lets admin or junk through', () => {
    for (const v of ['admin', '', 'EMPLOYER', 1, null, undefined, {}]) {
      expect(resolveSocialRole(v)).toBe('candidate')
    }
  })
})
