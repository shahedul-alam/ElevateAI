import { expect, test } from 'bun:test'
import { buildEvaluation } from './resume-evaluator.score'

const raw = {
  scores: { skills: 80, impact: 60, structure: 70, clarity: 90, completeness: 50 },
  strengths: ['Clear', ' Clear ', ''],
  weaknesses: ['  '],
  keywords: ['Docker', 'AWS', 'Docker'],
}

test('overall is the weighted average of the dimension scores', () => {
  // (80*25 + 60*25 + 70*15 + 90*20 + 50*15) / 100 = 71
  expect(buildEvaluation(raw).overall).toBe(71)
})

test('tidies lists and clamps out-of-range scores', () => {
  const out = buildEvaluation({ ...raw, scores: { ...raw.scores, skills: 140, impact: -5 } })
  expect(out.scores.skills).toBe(100)
  expect(out.scores.impact).toBe(0)
  expect(out.strengths).toEqual(['Clear'])
  expect(out.weaknesses).toEqual([])
  expect(out.keywords).toEqual(['Docker', 'AWS'])
})
