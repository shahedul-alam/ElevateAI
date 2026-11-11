import { HttpError } from '../../middleware/errors'

export const PDF_MIME = 'application/pdf'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const RESUME_TYPES = [PDF_MIME, DOCX_MIME]
export const RESUME_LIMIT = 5 * 1024 * 1024

/** Decides the type from the bytes; the client-supplied Content-Type is not trusted. */
export function detectResumeType(body: unknown): { data: Buffer; kind: 'pdf' | 'docx' } {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(415, 'Send the resume as a PDF or DOCX file')
  if (body.length > RESUME_LIMIT) throw new HttpError(413, `The resume must be under ${RESUME_LIMIT / 1024 / 1024} MB`)
  if (body.subarray(0, 5).toString('latin1') === '%PDF-') return { data: body, kind: 'pdf' }
  // A DOCX is a zip; the entry name sits uncompressed in the local file header.
  if (body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && body.includes('word/document.xml')) {
    return { data: body, kind: 'docx' }
  }
  throw new HttpError(415, 'The resume must be a PDF or DOCX file')
}
