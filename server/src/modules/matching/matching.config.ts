import type { DimensionKey } from './matching.types'

// Changing any value here changes scores: bump the version and keep the old
// config around so frozen application scores stay reproducible.
export const ENGINE_V1 = {
  version: 'v1',
  weights: {
    skills: 40,
    experience: 20,
    domain: 15,
    leadership: 10,
    certifications: 15,
  } satisfies Record<DimensionKey, number>,
  skillWeight: { required: 2, preferred: 1 },
  // Share of a skill's credit that comes from level vs. years when minYears is set (out of 10).
  skillLevelShare: 7,
  skillYearsShare: 3,
} as const

export type EngineConfig = typeof ENGINE_V1
