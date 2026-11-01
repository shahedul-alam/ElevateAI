import { hashContent, uniqueSorted } from '../../lib/content-hash'
import type { ProfileInput } from './candidate-profile.schema'

/**
 * Reduces equivalent profiles to one shape so they hash the same: duplicates collapse (strongest
 * skill wins, like the engine), lists are sorted, empty preferences are dropped.
 */
export function canonicalizeProfile(input: ProfileInput): ProfileInput {
  const skills = new Map<string, ProfileInput['skills'][number]>()
  for (const s of input.skills) {
    const prev = skills.get(s.termId)
    skills.set(s.termId, {
      termId: s.termId,
      level: Math.max(prev?.level ?? 0, s.level),
      years: Math.max(prev?.years ?? 0, s.years),
    })
  }

  const prefs = input.preferences
  return {
    headline: input.headline,
    summary: input.summary,
    skills: [...skills.values()].sort((a, b) => (a.termId < b.termId ? -1 : 1)),
    // Full-content tiebreak: two roles with the same title must still sort the same way every time.
    roles: input.roles
      .map((r) => ({
        title: r.title,
        years: r.years,
        ...(r.domainId && { domainId: r.domainId }),
        company: r.company,
        period: r.period,
        description: r.description,
      }))
      .sort((a, b) => a.title.localeCompare(b.title) || (hashContent(a) < hashContent(b) ? -1 : 1)),
    education: [...input.education].sort((a, b) => (hashContent(a) < hashContent(b) ? -1 : 1)),
    leadershipLevel: input.leadershipLevel,
    certIds: uniqueSorted(input.certIds),
    unmapped: uniqueSorted(input.unmapped),
    preferences: {
      locations: uniqueSorted(prefs.locations),
      workModes: uniqueSorted(prefs.workModes) as ProfileInput['preferences']['workModes'],
      ...(prefs.minSalary !== undefined && { minSalary: prefs.minSalary }),
    },
  }
}
