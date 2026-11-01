import type { DimensionKey } from './matching.types'

// Changing any value here changes scores. Once real applications exist, add a new version and
// keep this one so frozen application scores stay reproducible. (V1 was revised once, before
// launch, when education was added and no application had been stored yet.)
export const ENGINE_V1 = {
  version: 'v1',
  weights: {
    skills: 35,
    experience: 20,
    domain: 15,
    education: 10,
    leadership: 10,
    certifications: 10,
  } satisfies Record<DimensionKey, number>,
  skillWeight: { required: 2, preferred: 1 },
  // Share of a skill's credit that comes from level vs. years when minYears is set (out of 10).
  skillLevelShare: 7,
  skillYearsShare: 3,
} as const

export type EngineConfig = typeof ENGINE_V1
