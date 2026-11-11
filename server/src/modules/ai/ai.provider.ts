import { createOpenAI } from '@ai-sdk/openai'
import { generateText, Output, type ModelMessage } from 'ai'
import type { z } from 'zod'
import { env } from '../../config/env'
import { HttpError } from '../../middleware/errors'
import { resolveStub } from './ai.stub'

const openai = env.AI_ENABLED && env.OPENAI_API_KEY ? createOpenAI({ apiKey: env.OPENAI_API_KEY }) : null

/** The one place the AI SDK is called. Returns output validated against `schema`. */
export async function extractObject<T extends z.ZodType>(opts: {
  system: string
  messages: ModelMessage[]
  schema: T
  /** Canned output, returned instead of calling the model when AI_STUB is on (e2e only). */
  stub: z.infer<T>
  timeoutMs?: number
}): Promise<z.infer<T>> {
  if (env.AI_STUB) return resolveStub(opts.schema, opts.stub, opts.messages)
  if (!openai) throw new HttpError(503, 'AI features are not configured')
  try {
    const { output } = await generateText({
      model: openai(env.AI_MODEL_EXTRACT),
      system: opts.system,
      messages: opts.messages,
      output: Output.object({ schema: opts.schema }),
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      maxRetries: 1,
    })
    return output as z.infer<T>
  } catch (err) {
    console.error('AI call failed:', err)
    throw new HttpError(502, 'The AI service could not process this request. Try again.')
  }
}
