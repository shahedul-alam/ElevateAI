import type { ProfileInput } from '../candidate-profile/candidate-profile.schema'

const LEVELS = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']
const DEGREES = ['None', 'Diploma or associate', 'Bachelor', 'Master', 'Doctorate']
const LEADERSHIP = ['None', 'Team lead', 'Manager', 'Director or above']

/** Removes emails, links and phone-like numbers, and tidies whitespace. */
export const scrub = (text: string) =>
  text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '')
    .replace(/(https?:\/\/|www\.)\S+/gi, '')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Pure: the only resume data the model sees for an applicant summary. Skills, roles (title, length,
 * industry, description), degree level and field, certifications, leadership. Deliberately leaves out the
 * candidate name, contact details, photo, company and institution names, all dates and periods, and job
 * preferences, so the summary cannot repeat or lean on them.
 */
export function buildSummaryInput(profile: ProfileInput, names: Record<string, string>) {
  const name = (id: string) => names[id] ?? id
  return {
    headline: scrub(profile.headline),
    candidateSummary: scrub(profile.summary),
    skills: profile.skills.map((s) => ({ name: name(s.termId), level: LEVELS[s.level - 1], years: s.years })),
    roles: profile.roles.map((r) => ({
      title: r.title,
      years: r.years,
      industry: r.domainId ? name(r.domainId) : undefined,
      description: scrub(r.description),
    })),
    education: profile.education.map((e) => ({ degree: DEGREES[e.degreeLevel], field: e.field })),
    certifications: profile.certIds.map(name),
    leadership: LEADERSHIP[profile.leadershipLevel],
  }
}

/** Pure: strips anything contact-like the model may have repeated and caps the length. */
export const cleanSummary = (text: string) => scrub(text).slice(0, 600)
