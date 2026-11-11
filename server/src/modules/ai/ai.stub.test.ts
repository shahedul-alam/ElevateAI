import { expect, test } from 'bun:test'
import { z } from 'zod'
import { resolveStub, STUB_FAIL_MARKER } from './ai.stub'

const schema = z.object({ summary: z.string().max(5) })

test('returns the canned output, parsed through the real schema', () => {
  expect(resolveStub(schema, { summary: 'ok' }, [{ role: 'user', content: 'hello' }])).toEqual({ summary: 'ok' })
})

test('a stub that does not fit the schema is rejected', () => {
  expect(() => resolveStub(schema, { summary: 'far too long' }, [{ role: 'user', content: 'hi' }])).toThrow()
})

test('the fail marker in a text message or text part makes it fail with 502', () => {
  const stub = { summary: 'ok' }
  expect(() => resolveStub(schema, stub, [{ role: 'user', content: `x ${STUB_FAIL_MARKER} y` }])).toThrow(
    /could not process/,
  )
  expect(() =>
    resolveStub(schema, stub, [{ role: 'user', content: [{ type: 'text', text: STUB_FAIL_MARKER }] }]),
  ).toThrow(/could not process/)
})

test('file parts are not searched', () => {
  const file = { type: 'file' as const, data: Buffer.from(STUB_FAIL_MARKER), mediaType: 'application/pdf' }
  expect(resolveStub(schema, { summary: 'ok' }, [{ role: 'user', content: [file] }])).toEqual({ summary: 'ok' })
})
