import { expect, test } from 'bun:test'
import { normalizeAlias } from './catalog.normalize'

test('spelling variants collapse to one key', () => {
  const keys = ['React.js', 'react js', 'ReactJS', ' REACT-JS '].map(normalizeAlias)
  expect(new Set(keys).size).toBe(1)
})

test('symbol-bearing names stay distinct', () => {
  expect(normalizeAlias('C++')).not.toBe(normalizeAlias('C'))
  expect(normalizeAlias('C#')).not.toBe(normalizeAlias('C'))
})
