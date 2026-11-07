import type { ProfileInput } from '../candidate-profile/candidate-profile.schema'
import type { JobInput } from '../jobs/jobs.schema'
import type { GapExplanationResult } from './gap-explanation.schema'
import type { DimensionKey, EligibilityResult } from './matching.types'

const LEVELS = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']
const DEGREES = ['None', 'Diploma or associate', 'Bachelor', 'Master', 'Doctorate']
const LEADERSHIP = ['None', 'Team lead', 'Manager', 'Director or above']
const AREA: Record<DimensionKey, string> = {
  skills: 'Skills',
  experience: 'Experience',
  domain: 'Industry',
  education: 'Education',
  leadership: 'Leadership',
  certifications: 'Certifications',
}

type GapLike = {
  score: number
  dimensions: { key: DimensionKey; score: number; applicable: boolean }[]
  eligibility: EligibilityResult
  missing: { skills: { name: string; required: boolean }[]; certs: { name: string }[] }
}

/**
 * Pure: the only data the model sees. Public job requirements, the candidate's skills and levels,
 * and the gap numbers, as readable labels. Never contact details, photo, summary, role text,
 * preference values, or anything an employer keeps private.
 */
export function buildExplainInput(
  gap: GapLike,
  job: JobInput,
  profile: ProfileInput,
  names: Record<string, string>,
) {
  const name = (id: string) => names[id] ?? id
  const skill = (s: JobInput['skills'][number]) => ({
    name: name(s.termId),
    minLevel: LEVELS[s.minLevel - 1],
    minYears: s.minYears,
  })
  return {
    matchScore: gap.score,
    job: {
      title: job.title,
      requiredSkills: job.skills.filter((s) => s.required).map(skill),
      preferredSkills: job.skills.filter((s) => !s.required).map(skill),
      minYearsExperience: job.minYears || undefined,
      industry: job.domainId ? name(job.domainId) : undefined,
      minDegree: job.minDegreeLevel ? DEGREES[job.minDegreeLevel] : undefined,
      leadership: job.leadershipLevel ? LEADERSHIP[job.leadershipLevel] : undefined,
      certifications: job.certIds.map(name),
    },
    candidate: {
      skills: profile.skills.map((s) => ({ name: name(s.termId), level: LEVELS[s.level - 1], years: s.years })),
      certifications: profile.certIds.map(name),
      highestDegree: DEGREES[Math.max(0, ...profile.education.map((e) => e.degreeLevel))],
      leadership: LEADERSHIP[profile.leadershipLevel],
    },
    areaScores: gap.dimensions.filter((d) => d.applicable).map((d) => ({ area: AREA[d.key], score: d.score })),
    missingSkills: gap.missing.skills.map((s) => ({ name: s.name, required: s.required })),
    missingCertifications: gap.missing.certs.map((c) => c.name),
    // Labels only (ok, mismatch, unknown): no preference values.
    fit: gap.eligibility,
  }
}

const clean = (s: string) => s.trim()

/** Pure: trims and drops empty steps. */
export function cleanExplanation(raw: GapExplanationResult): GapExplanationResult {
  return {
    summary: clean(raw.summary),
    steps: raw.steps
      .map((s) => ({ focus: clean(s.focus), action: clean(s.action) }))
      .filter((s) => s.focus && s.action)
      .slice(0, 5),
  }
}
