import type { ModelMessage } from 'ai'
import type { z } from 'zod'
import { HttpError } from '../../middleware/errors'

/** Put this in the text a spec sends to make the stubbed model fail like a provider error. */
export const STUB_FAIL_MARKER = '__stub_fail__'

/** Only the text parts: file parts (a PDF) can be megabytes and are never searched. */
const messageText = (messages: ModelMessage[]) =>
  messages
    .flatMap((m) =>
      typeof m.content === 'string' ? [m.content] : m.content.flatMap((p) => (p.type === 'text' ? [p.text] : [])),
    )
    .join('\n')

/**
 * Pure: what `extractObject` returns when AI_STUB is on. The canned output goes through the real schema, so
 * a stub can never drift from the shape the feature expects; the fail marker reproduces a provider failure.
 */
export function resolveStub<T extends z.ZodType>(schema: T, stub: z.infer<T>, messages: ModelMessage[]): z.infer<T> {
  if (messageText(messages).includes(STUB_FAIL_MARKER)) {
    throw new HttpError(502, 'The AI service could not process this request. Try again.')
  }
  return schema.parse(stub)
}
