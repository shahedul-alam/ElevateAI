import { ENGINE_V1, type EngineConfig } from './matching.config'
import type {
  DimensionKey,
  DimensionResult,
  EligibilityResult,
  EligibilityStatus,
  JobContent,
  JobSkill,
  MatchResult,
  MissingSkill,
  ProfileContent,
  ProfileSkill,
} from './matching.types'

// Pure and deterministic: no DB, clock, randomness or network. All ratios are
// integer basis points (10000 = 100%) so results never depend on float rounding.
const FULL = 10000

const ratioBp = (have: number, need: number) => {
  if (need <= 0) return FULL
  // Years are decimals; compare in hundredths so 0.1 + 0.2 style sums cannot drift.
  return Math.min(Math.floor((Math.round(have * 100) * FULL) / Math.round(need * 100)), FULL)
}

const bpToScore = (bp: number) => Math.floor((bp + 50) / 100)

const dedupeCandidateSkills = (skills: ProfileSkill[]) => {
  const byId = new Map<string, ProfileSkill>()
  for (const s of skills) {
    const prev = byId.get(s.termId)
    byId.set(s.termId, {
      termId: s.termId,
      level: Math.max(prev?.level ?? 0, s.level),
      years: Math.max(prev?.years ?? 0, s.years),
    })
  }
  return byId
}

const dedupeJobSkills = (skills: JobSkill[]) => {
  const byId = new Map<string, JobSkill>()
  for (const s of skills) {
    const prev = byId.get(s.termId)
    byId.set(s.termId, {
      termId: s.termId,
      required: (prev?.required ?? false) || s.required,
      minLevel: Math.max(prev?.minLevel ?? 1, s.minLevel),
      minYears: Math.max(prev?.minYears ?? 0, s.minYears ?? 0) || undefined,
    })
  }
  return byId
}

type DimensionBp = { bp: number; applicable: boolean }

export function matchEngine(
  profile: ProfileContent,
  job: JobContent,
  config: EngineConfig = ENGINE_V1,
): MatchResult {
  const candSkills = dedupeCandidateSkills(profile.skills)
  const jobSkills = [...dedupeJobSkills(job.skills).values()].sort((a, b) =>
    a.termId < b.termId ? -1 : 1,
  )

  const missingSkills: MissingSkill[] = []
  let skillWeightSum = 0
  let skillCreditSum = 0
  for (const js of jobSkills) {
    const weight = js.required ? config.skillWeight.required : config.skillWeight.preferred
    const cand = candSkills.get(js.termId)
    const levelBp = cand ? ratioBp(cand.level, js.minLevel) : 0
    const credit = js.minYears
      ? Math.floor(
          (config.skillLevelShare * levelBp +
            config.skillYearsShare * (cand ? ratioBp(cand.years, js.minYears) : 0)) /
            10,
        )
      : levelBp
    skillWeightSum += weight
    skillCreditSum += weight * credit
    if (credit < FULL) missingSkills.push({ termId: js.termId, required: js.required })
  }
  const skills: DimensionBp =
    jobSkills.length > 0
      ? { bp: Math.floor(skillCreditSum / skillWeightSum), applicable: true }
      : { bp: 0, applicable: false }

  const totalYears = profile.roles.reduce((sum, r) => sum + Math.round(r.years * 100), 0) / 100
  const experience: DimensionBp =
    job.minYears > 0
      ? { bp: ratioBp(totalYears, job.minYears), applicable: true }
      : { bp: 0, applicable: false }

  let domain: DimensionBp = { bp: 0, applicable: false }
  if (job.domainId) {
    const domainYears =
      profile.roles
        .filter((r) => r.domainId === job.domainId)
        .reduce((sum, r) => sum + Math.round(r.years * 100), 0) / 100
    // No stated minimum means any time in the domain counts as a full match.
    const bp = job.minDomainYears > 0 ? ratioBp(domainYears, job.minDomainYears) : domainYears > 0 ? FULL : 0
    domain = { bp, applicable: true }
  }

  // Highest degree held; the job's minimum is the bar. Unspecified (0) skips the dimension.
  const highestDegree = profile.education.reduce((max, ed) => Math.max(max, ed.degreeLevel), 0)
  const education: DimensionBp =
    job.minDegreeLevel > 0
      ? { bp: ratioBp(highestDegree, job.minDegreeLevel), applicable: true }
      : { bp: 0, applicable: false }

  const leadership: DimensionBp =
    job.leadershipLevel > 0
      ? { bp: ratioBp(profile.leadershipLevel, job.leadershipLevel), applicable: true }
      : { bp: 0, applicable: false }

  const jobCerts = [...new Set(job.certIds)].sort()
  const candCerts = new Set(profile.certIds)
  const missingCerts = jobCerts.filter((c) => !candCerts.has(c))
  const certifications: DimensionBp =
    jobCerts.length > 0
      ? {
          bp: Math.floor(((jobCerts.length - missingCerts.length) * FULL) / jobCerts.length),
          applicable: true,
        }
      : { bp: 0, applicable: false }

  const bps: Record<DimensionKey, DimensionBp> = {
    skills,
    experience,
    domain,
    education,
    leadership,
    certifications,
  }

  let weightedSum = 0
  let weightSum = 0
  const dimensions: DimensionResult[] = (Object.keys(bps) as DimensionKey[]).map((key) => {
    const { bp, applicable } = bps[key]
    const weight = config.weights[key]
    if (applicable) {
      weightedSum += weight * bp
      weightSum += weight
    }
    return { key, score: applicable ? bpToScore(bp) : 0, weight, applicable }
  })

  // A job with no requirements at all matches everyone fully.
  const overallBp = weightSum > 0 ? Math.floor(weightedSum / weightSum) : FULL

  return {
    score: bpToScore(overallBp),
    engineVersion: config.version,
    dimensions,
    missing: { skills: missingSkills, certs: missingCerts },
  }
}

const norm = (s: string) => s.trim().toLowerCase()

// Eligibility is reported next to the score and never changes it.
export function checkEligibility(profile: ProfileContent, job: JobContent): EligibilityResult {
  const prefs = profile.preferences

  let location: EligibilityStatus = 'unknown'
  if (job.workMode === 'remote') location = 'ok'
  else if (job.location && prefs?.locations?.length) {
    location = prefs.locations.some((l) => norm(l) === norm(job.location!)) ? 'ok' : 'mismatch'
  }

  let workMode: EligibilityStatus = 'unknown'
  if (job.workMode && prefs?.workModes?.length) {
    workMode = prefs.workModes.includes(job.workMode) ? 'ok' : 'mismatch'
  }

  let salary: EligibilityStatus = 'unknown'
  if (job.salaryMax !== undefined && prefs?.minSalary !== undefined) {
    salary = job.salaryMax >= prefs.minSalary ? 'ok' : 'mismatch'
  }

  return { location, workMode, salary }
}
