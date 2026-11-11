import { DIMENSIONS, RUBRIC_V1 } from './resume-evaluator.config'
import type { Evaluation, RawEvaluation } from './resume-evaluator.schema'

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))
const clean = (items: string[]) => [...new Set(items.map((s) => s.trim()).filter(Boolean))]

/** Pure: tidies the model output and computes the overall score from the fixed rubric weights. */
export function buildEvaluation(raw: RawEvaluation): Evaluation {
  const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, clamp(raw.scores[d])])) as RawEvaluation['scores']
  const total = DIMENSIONS.reduce((sum, d) => sum + RUBRIC_V1[d], 0)
  const weighted = DIMENSIONS.reduce((sum, d) => sum + scores[d] * RUBRIC_V1[d], 0)
  return {
    scores,
    overall: clamp(weighted / total),
    strengths: clean(raw.strengths),
    weaknesses: clean(raw.weaknesses),
    keywords: clean(raw.keywords),
  }
}
