// Image bytes for upload tests. The server decides the type from the first bytes, so the non-PNG
// fixtures below only carry a valid signature. PNG_1X1 is a real image the browser can decode.

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** A tiny valid PNG. A different `variant` appends trailing bytes, giving a different content hash. */
export const pngImage = (variant = 0) =>
  variant === 0 ? PNG_1X1 : Buffer.concat([PNG_1X1, Buffer.from(`variant-${variant}`)])

export const jpegImage = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)])

/** A real 1x1 grey JPEG, for checks that the browser decodes the upload. */
export const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
)

export const webpImage = () =>
  Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([32, 0, 0, 0]), Buffer.from('WEBP', 'ascii'), Buffer.alloc(24)])

export const gifImage = () => Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(24)])

/** PNG signature followed by padding up to exactly `size` bytes. */
export const pngOfSize = (size: number) =>
  Buffer.concat([PNG_1X1.subarray(0, 8), Buffer.alloc(size - 8)])
