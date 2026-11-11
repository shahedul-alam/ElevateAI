import type { CurrentProfile } from './profile.api'

export type ChecklistItem = { key: string; label: string; done: boolean }

/**
 * Which parts of the candidate's profile are filled in. Field presence only, so it needs no AI and no quota
 * (the resume review's own "completeness" score is separate). Pure: callers pass the photo and review state.
 */
export function completeness(profile: CurrentProfile | null, hasPhoto: boolean, reviewed: boolean) {
  const c = profile?.content
  const contact = profile?.contact
  const prefs = c?.preferences
  const items: ChecklistItem[] = [
    { key: 'resume', label: 'Build and save your resume', done: !!profile },
    { key: 'headline', label: 'Add a headline', done: !!c?.headline.trim() },
    { key: 'summary', label: 'Write a short summary', done: !!c?.summary.trim() },
    { key: 'skills', label: 'Add your skills', done: (c?.skills.length ?? 0) > 0 },
    { key: 'roles', label: 'Add a work role', done: (c?.roles.length ?? 0) > 0 },
    { key: 'education', label: 'Add your education', done: (c?.education.length ?? 0) > 0 },
    {
      key: 'preferences',
      label: 'Set your job preferences',
      done: !!prefs && (prefs.locations.length > 0 || prefs.workModes.length > 0 || prefs.minSalary !== undefined),
    },
    {
      key: 'contact',
      label: 'Add contact details',
      done: !!contact && [contact.phone, contact.email, contact.city].some((v) => v.trim() !== ''),
    },
    { key: 'photo', label: 'Add a photo (optional)', done: hasPhoto },
    { key: 'review', label: 'Get your resume reviewed', done: reviewed },
  ]
  const done = items.filter((i) => i.done).length
  return { percent: Math.round((done / items.length) * 100), items }
}
