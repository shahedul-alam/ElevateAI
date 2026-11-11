import { normalizeAlias } from '../catalog/catalog.normalize'
import type { DraftOutput } from './job-assistant.schema'

const trimmed = (items: string[]) =>
  [...new Set(items.map((s) => s.trim().slice(0, 300)).filter(Boolean))].slice(0, 20)

/**
 * Pure: turns the model's draft into form content. Only display fields and catalog skills are
 * produced; every scored requirement besides skills is left for the employer to set.
 */
export function mapJobDraft(raw: DraftOutput, skillLookup: Map<string, string>) {
  const skills = new Map<string, { termId: string; required: boolean }>()
  const unmappedSkills: string[] = []
  for (const s of raw.skills) {
    const id = skillLookup.get(normalizeAlias(s.name))
    if (id) {
      const seen = skills.get(id)
      skills.set(id, { termId: id, required: s.required || !!seen?.required })
    } else if (s.name.trim()) unmappedSkills.push(s.name.trim())
  }
  return {
    draft: {
      title: raw.title.trim().slice(0, 120),
      description: raw.description.trim().slice(0, 5000),
      employmentType: raw.employmentType || undefined,
      responsibilities: trimmed(raw.responsibilities),
      qualifications: trimmed(raw.qualifications),
      perks: trimmed(raw.perks),
      otherDetails: trimmed(raw.otherDetails),
      skills: [...skills.values()].slice(0, 30),
    },
    unmappedSkills: [...new Set(unmappedSkills)],
  }
}
