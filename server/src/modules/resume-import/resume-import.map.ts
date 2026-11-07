import { normalizeAlias } from '../catalog/catalog.normalize'
import { profileContentSchema, type ProfileInput } from '../candidate-profile/candidate-profile.schema'
import type { Extraction } from './resume-import.schema'

/** normalized alias -> approved term id, per kind. */
export type AliasLookup = { skill: Map<string, string>; certification: Map<string, string>; domain: Map<string, string> }

/** Pure: turns the model's free text into profile content. Anything not in the catalog goes to `unmapped`. */
export function mapExtraction(raw: Extraction, lookup: AliasLookup): ProfileInput {
  const unmapped: string[] = []
  const skills = new Map<string, { termId: string; level: number; years: number }>()
  for (const s of raw.skills) {
    const id = lookup.skill.get(normalizeAlias(s.name))
    if (id) {
      if (!skills.has(id)) skills.set(id, { termId: id, level: s.level, years: s.years })
    } else if (s.name.trim()) unmapped.push(s.name.trim())
  }
  const certIds = new Set<string>()
  for (const c of raw.certifications) {
    const id = lookup.certification.get(normalizeAlias(c))
    if (id) certIds.add(id)
    else if (c.trim()) unmapped.push(c.trim())
  }
  return profileContentSchema.parse({
    headline: raw.headline.slice(0, 120),
    summary: raw.summary.slice(0, 2000),
    skills: [...skills.values()],
    roles: raw.roles
      .filter((r) => r.title.trim())
      .map((r) => ({
        title: r.title,
        company: r.company,
        period: r.period,
        description: r.description,
        years: r.years,
        domainId: lookup.domain.get(normalizeAlias(r.domain)),
      })),
    education: raw.education,
    // Scored fields the resume cannot settle: the candidate sets these.
    leadershipLevel: 0,
    certIds: [...certIds],
    unmapped: [...new Set(unmapped)].slice(0, 20),
    preferences: { locations: [], workModes: [] },
  })
}
