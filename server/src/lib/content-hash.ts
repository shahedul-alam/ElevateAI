import { createHash } from 'node:crypto'

// Key order and undefined fields must not matter: equal content always hashes equal.
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export const hashContent = (content: unknown) =>
  createHash('sha256').update(stableStringify(content)).digest('hex')

export const uniqueSorted = (items: string[]) => [...new Set(items)].sort()
