import { uniqueSorted } from '../../lib/content-hash'
import type { JobInput } from './jobs.schema'

/** Equivalent job posts reduce to one shape (and hash): skills deduped and sorted, certs sorted. */
export function canonicalizeJob(input: JobInput): JobInput {
  const skills = new Map<string, JobInput['skills'][number]>()
  for (const s of input.skills) {
    const prev = skills.get(s.termId)
    const minYears = Math.max(prev?.minYears ?? 0, s.minYears ?? 0)
    skills.set(s.termId, {
      termId: s.termId,
      required: (prev?.required ?? false) || s.required,
      minLevel: Math.max(prev?.minLevel ?? 1, s.minLevel),
      ...(minYears > 0 && { minYears }),
    })
  }

  return {
    title: input.title,
    description: input.description,
    skills: [...skills.values()].sort((a, b) => (a.termId < b.termId ? -1 : 1)),
    minYears: input.minYears,
    ...(input.domainId && { domainId: input.domainId }),
    minDomainYears: input.minDomainYears,
    minDegreeLevel: input.minDegreeLevel,
    leadershipLevel: input.leadershipLevel,
    certIds: uniqueSorted(input.certIds),
    ...(input.location && { location: input.location }),
    ...(input.workMode && { workMode: input.workMode }),
    ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
    ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
  }
}

/** A job with no scored requirement would match everyone at 100, so it cannot be published. */
export const hasScoredRequirement = (j: JobInput) =>
  j.skills.length > 0 ||
  j.minYears > 0 ||
  !!j.domainId ||
  j.minDegreeLevel > 0 ||
  j.leadershipLevel > 0 ||
  j.certIds.length > 0
