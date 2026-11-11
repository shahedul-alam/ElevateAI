import { expect, test } from 'bun:test'
import { detectResumeType, RESUME_LIMIT } from './resume-import.file'

test('detects pdf and docx by bytes', () => {
  expect(detectResumeType(Buffer.from('%PDF-1.7 x')).kind).toBe('pdf')
  const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('....word/document.xml')])
  expect(detectResumeType(docx).kind).toBe('docx')
})

test('rejects junk, empty, a plain zip and oversize', () => {
  expect(() => detectResumeType(Buffer.from('MZ junk'))).toThrow()
  expect(() => detectResumeType(Buffer.alloc(0))).toThrow()
  expect(() => detectResumeType({})).toThrow()
  expect(() => detectResumeType(Buffer.from([0x50, 0x4b, 3, 4, 1, 2]))).toThrow()
  expect(() => detectResumeType(Buffer.alloc(RESUME_LIMIT + 1, 0x25))).toThrow()
})
