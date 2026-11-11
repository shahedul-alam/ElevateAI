// Rubric V1. Stored results record the version they were scored with, so a weight or rule change
// needs a new version (RUBRIC_V2), never an edit to V1.
export const RUBRIC_VERSION = 1

export const DIMENSIONS = ['skills', 'impact', 'structure', 'clarity', 'completeness'] as const
export type Dimension = (typeof DIMENSIONS)[number]

export const RUBRIC_V1: Record<Dimension, number> = {
  skills: 25,
  impact: 25,
  structure: 15,
  clarity: 20,
  completeness: 15,
}

export const DIMENSION_LABEL: Record<Dimension, string> = {
  skills: 'Skills relevance',
  impact: 'Impact',
  structure: 'Structure',
  clarity: 'Clarity',
  completeness: 'Completeness',
}

/** New (not cached) evaluations a user may run per day. */
export const EVAL_DAILY_LIMIT = 5
