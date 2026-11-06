import { expect, test } from 'bun:test'
import { PHOTO_LIMIT, validatePhoto } from './candidate-photo'

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)])
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const webp = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary')

const statusOf = (body: unknown) => {
  try {
    validatePhoto(body)
    return 200
  } catch (e) {
    return (e as { status: number }).status
  }
}

test('accepts PNG and JPEG, deciding the type from the bytes', () => {
  expect(validatePhoto(png).contentType).toBe('image/png')
  expect(validatePhoto(jpeg).contentType).toBe('image/jpeg')
})

test('rejects WebP, GIF, text, empty and non-buffer bodies with 415', () => {
  for (const body of [webp, Buffer.from('GIF89a'), Buffer.from('<svg/>'), Buffer.alloc(0), {}, undefined]) {
    expect(statusOf(body)).toBe(415)
  }
})

test('rejects a photo over the limit with 413', () => {
  expect(statusOf(Buffer.concat([png, Buffer.alloc(PHOTO_LIMIT)]))).toBe(413)
})
