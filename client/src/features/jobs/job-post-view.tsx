import type { ReactNode } from 'react'

import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyLogo } from '@/features/company/company-logo'
import { VerifiedBadge } from '@/features/company/company-profile-view'
import type { CompanyRef } from '@/features/company/company.schema'
import { DEGREE_LABELS, LEADERSHIP_LABELS, LEVEL_LABELS } from '@/features/profile/profile.schema'

import { formatSalary } from './format'
import { EMPLOYMENT_LABELS, type JobContent } from './jobs.schema'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

/**
 * The one renderer for a job post. The public job page and the employer's live
 * preview both use it, so a post looks the same wherever it is shown.
 */
export function JobPostView({
  content: c,
  termNames,
  employerName,
  company,
  children,
}: {
  content: JobContent
  termNames: Record<string, string>
  employerName?: string
  /** The company behind the post; when present the header links to its profile page. */
  company?: CompanyRef | null
  /** Rendered between the header and the body (the job page puts the match card here). */
  children?: ReactNode
}) {
  const name = (termId: string) => termNames[termId] ?? termId
  const salary = formatSalary(c.salaryMin, c.salaryMax)
  const chips = [
    c.location,
    c.workMode && c.workMode[0]!.toUpperCase() + c.workMode.slice(1),
    c.employmentType && EMPLOYMENT_LABELS[c.employmentType],
    salary,
  ].filter(Boolean) as string[]

  // Display-only lists, shown only when the employer filled them in.
  const lists = [
    { title: 'Key responsibilities', items: c.responsibilities },
    { title: 'Qualifications', items: c.qualifications },
    { title: 'Perks & benefits', items: c.perks },
    { title: 'Other details', items: c.otherDetails },
  ].filter((l) => (l.items?.length ?? 0) > 0)

  const required = c.skills.filter((s) => s.required)
  const preferred = c.skills.filter((s) => !s.required)
  const skillLine = (s: JobContent['skills'][number]) =>
    `${name(s.termId)} · ${LEVEL_LABELS[s.minLevel - 1]}${s.minYears ? ` · ${s.minYears}+ yrs` : ''}`
  const hasRequirements =
    c.skills.length > 0 ||
    c.minYears > 0 ||
    !!c.domainId ||
    c.minDegreeLevel > 0 ||
    c.leadershipLevel > 0 ||
    c.certIds.length > 0

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b pb-6">
        {company ? (
          <div className="flex flex-wrap items-center gap-3">
            <CompanyLogo id={company.id} name={company.name} logoUrl={company.logoUrl} className="size-12" />
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/companies/${company.id}`} className="font-medium hover:underline">
                  {company.name}
                </Link>
                {company.verified && <VerifiedBadge />}
              </div>
              {company.tagline && <p className="text-sm text-muted-foreground">{company.tagline}</p>}
            </div>
            <Link to={`/companies/${company.id}`} className="ml-auto text-sm underline">
              View company profile
            </Link>
          </div>
        ) : (
          employerName && <p className="text-sm font-medium text-muted-foreground">{employerName}</p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{c.title || 'Untitled job'}</h1>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip} className="rounded-full border bg-muted/50 px-3 py-1 text-sm">
                {chip}
              </li>
            ))}
          </ul>
        )}
        {c.applicationDeadline && (
          <p className="text-sm text-muted-foreground">Apply by {formatDate(c.applicationDeadline)}</p>
        )}
      </header>

      {children}

      <Card>
        <CardHeader>
          <CardTitle>About the role</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {c.description || 'No description yet.'}
          </p>
        </CardContent>
      </Card>

      {lists.map((l) => (
        <Card key={l.title}>
          <CardHeader>
            <CardTitle>{l.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {l.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {hasRequirements && (
        <Card>
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {required.length > 0 && (
              <section>
                <h2 className="mb-1 font-medium">Required skills</h2>
                <ul className="list-disc pl-5">
                  {required.map((s) => (
                    <li key={s.termId}>{skillLine(s)}</li>
                  ))}
                </ul>
              </section>
            )}
            {preferred.length > 0 && (
              <section>
                <h2 className="mb-1 font-medium">Preferred skills</h2>
                <ul className="list-disc pl-5">
                  {preferred.map((s) => (
                    <li key={s.termId}>{skillLine(s)}</li>
                  ))}
                </ul>
              </section>
            )}
            <ul className="flex flex-col gap-1">
              {c.minYears > 0 && <li>{c.minYears}+ years of experience</li>}
              {c.domainId && (
                <li>
                  {name(c.domainId)} industry
                  {c.minDomainYears > 0 ? ` · ${c.minDomainYears}+ years` : ''}
                </li>
              )}
              {c.minDegreeLevel > 0 && <li>Education: {DEGREE_LABELS[c.minDegreeLevel]} or above</li>}
              {c.leadershipLevel > 0 && <li>Leadership: {LEADERSHIP_LABELS[c.leadershipLevel]} or above</li>}
              {c.certIds.length > 0 && <li>Certifications: {c.certIds.map(name).join(', ')}</li>}
            </ul>
          </CardContent>
        </Card>
      )}
    </article>
  )
}
