// Relative imports only: this file is unit-tested with `bun test`, which has no `@/` alias set up.
import { safeHref } from '../../lib/safe-href'
import {
  DEGREE_LABELS,
  LEADERSHIP_LABELS,
  LEVEL_LABELS,
  type Contact,
  type ProfileContent,
} from '../profile/profile.schema'

/** Everything a rendered resume shows, as plain data. The preview and the PDF both draw from this. */
export type ResumeModel = {
  name: string
  headline: string
  /** Contact email, phone and "city, country", in that order, when present. */
  contact: string[]
  links: { label: string; url: string }[]
  summary: string
  skills: { name: string; level: string; years: number }[]
  experience: { title: string; company: string; period: string; domain: string; description: string }[]
  education: { heading: string; institution: string; period: string }[]
  certifications: string[]
  /** Free-form lines such as leadership and skills that are not in the catalog. */
  additional: string[]
  /** The candidate's photo as a data URL (PNG or JPEG), when they added one. */
  photo?: string
}

type Input = {
  photo?: string
  name: string
  accountEmail: string
  content: ProfileContent
  contact: Contact
  termNames: Record<string, string>
}

export const formatYears = (years: number) => `${years} ${years === 1 ? 'yr' : 'yrs'}`

export const skillLabel = (s: ResumeModel['skills'][number]) => `${s.name} (${s.level}, ${formatYears(s.years)})`

/**
 * Builds the resume from a saved version plus the current contact record. Job preferences
 * (locations, work modes, minimum salary) are deliberately never read: they are private to the
 * candidate and do not belong on a resume.
 */
export function buildResumeModel({ name, accountEmail, content, contact, termNames, photo }: Input): ResumeModel {
  const label = (id: string) => termNames[id] ?? id

  const place = [contact.city, contact.country].filter(Boolean).join(', ')
  const links = [
    { label: 'LinkedIn', url: contact.linkedin },
    { label: 'GitHub', url: contact.github },
    { label: 'Website', url: contact.website },
    { label: 'Other', url: contact.other },
  ].filter((l) => l.url && safeHref(l.url))

  const additional = [
    content.leadershipLevel > 0 ? `Leadership: ${LEADERSHIP_LABELS[content.leadershipLevel]}` : '',
    content.unmapped.length > 0 ? `Other skills: ${content.unmapped.join(', ')}` : '',
  ].filter(Boolean)

  return {
    name,
    headline: content.headline,
    contact: [contact.email || accountEmail, contact.phone, place].filter(Boolean),
    links,
    summary: content.summary,
    skills: content.skills
      .map((s) => ({ name: label(s.termId), level: LEVEL_LABELS[s.level - 1] ?? String(s.level), years: s.years }))
      .sort((a, b) => levelRank(b.level) - levelRank(a.level) || a.name.localeCompare(b.name)),
    // Entry order is the candidate's own, so it is kept.
    experience: content.roles.map((r) => ({
      title: r.title,
      company: r.company,
      period: r.period || formatYears(r.years),
      domain: r.domainId ? label(r.domainId) : '',
      description: r.description,
    })),
    education: content.education.map((e) => ({
      heading: [DEGREE_LABELS[e.degreeLevel], e.field].filter(Boolean).join(', '),
      institution: e.institution,
      period: e.period,
    })),
    certifications: content.certIds.map(label).sort((a, b) => a.localeCompare(b)),
    additional,
    ...(photo && { photo }),
  }
}

const levelRank = (level: string) => (LEVEL_LABELS as readonly string[]).indexOf(level)

/** `Jane-Doe-Resume.pdf`, or `Jane-Doe-Resume-2026-11-02.pdf` for an older version saved on that date. */
export function resumeFilename(name: string, versionDate?: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const date = versionDate ? `-${versionDate.slice(0, 10)}` : ''
  return `${slug || 'My'}-Resume${date}.pdf`
}

/** Every piece of text the resume shows. */
export function resumeText(m: ResumeModel): string[] {
  return [
    m.name,
    m.headline,
    ...m.contact,
    ...m.links.flatMap((l) => [l.label, l.url]),
    m.summary,
    ...m.skills.map(skillLabel),
    ...m.experience.flatMap((e) => [e.title, e.company, e.period, e.domain, e.description]),
    ...m.education.flatMap((e) => [e.heading, e.institution, e.period]),
    ...m.certifications,
    ...m.additional,
  ].filter(Boolean)
}

// The PDF uses the standard Helvetica font, which covers Windows-1252 (Latin letters, accents and
// common punctuation) but no other script. Anything else would print as blanks.
const PDF_SAFE =
  /^[\t\n\r -~ -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/

export const hasPdfUnsupportedChars = (m: ResumeModel) => resumeText(m).some((t) => !PDF_SAFE.test(t))
