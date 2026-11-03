import { BadgeCheck, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatSalary } from '@/features/jobs/format'
import type { JobCard } from '@/features/jobs/jobs.api'
import { EMPLOYMENT_LABELS } from '@/features/jobs/jobs.schema'
import { safeHref } from '@/lib/safe-href'

import { CompanyCover, CompanyLogo } from './company-logo'
import { WORK_POLICY_LABELS, type Company } from './company.schema'

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ${className ?? ''}`}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      Verified Employer
    </span>
  )
}

/** "Apply by Dec 15, 2026", or a note once the date has passed (the job does not close by itself). */
const deadlineLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`)
  const text = date.toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
  const endOfDay = date.getTime() + 24 * 60 * 60 * 1000
  return Date.now() >= endOfDay ? `Deadline passed (${text})` : `Apply by ${text}`
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The one renderer for a company page. The public page and the employer's live preview both use
 * it, so the page looks the same wherever it is shown. Empty sections are hidden.
 */
export function CompanyProfileView({
  company: c,
  jobs = [],
  termNames = {},
  actions,
}: {
  company: Company
  jobs?: JobCard[]
  termNames?: Record<string, string>
  /** Buttons shown beside the name (edit link, verify toggle, ...). */
  actions?: ReactNode
}) {
  const facts = [
    { label: 'Headquarters', value: c.headquarters },
    { label: 'Company size', value: c.size && `${c.size} employees` },
    { label: 'Funding stage', value: c.fundingStage },
    { label: 'Founded', value: c.foundedYear ? `Est. ${c.foundedYear}` : '' },
    { label: 'Industry', value: c.domainId ? (termNames[c.domainId] ?? '') : '' },
    { label: 'Work policy', value: c.workPolicy ? WORK_POLICY_LABELS[c.workPolicy] : '' },
  ].filter((f) => f.value)

  const socials = [
    { label: 'LinkedIn', url: c.links.linkedin },
    { label: 'GitHub', url: c.links.github },
    { label: 'X / Twitter', url: c.links.x },
  ].filter((s) => s.url && safeHref(s.url))
  const website = c.website && safeHref(c.website)
  const buttons = [
    ...(website ? [{ label: 'Website', url: website }] : []),
    ...socials.map((s) => ({ label: s.label, url: s.url })),
  ]

  const empty =
    !c.about &&
    !c.mission &&
    c.culture.length === 0 &&
    c.awards.length === 0 &&
    c.benefits.length === 0 &&
    c.hubs.length === 0 &&
    facts.length === 0

  return (
    <article className="flex flex-col gap-6">
      <div>
        <CompanyCover id={c.id} name={c.name} coverUrl={c.coverUrl} className="h-40 rounded-xl sm:h-56" />
        <div className="-mt-10 flex flex-wrap items-end gap-4 px-4 sm:-mt-12 sm:px-6">
          <CompanyLogo
            id={c.id}
            name={c.name}
            logoUrl={c.logoUrl}
            className="size-20 rounded-xl border-4 border-background text-2xl sm:size-24 sm:text-3xl"
          />
          <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">{actions}</div>
        </div>
        <div className="mt-3 flex flex-col gap-2 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
            {c.verified && <VerifiedBadge />}
          </div>
          {c.tagline && <p className="text-muted-foreground">{c.tagline}</p>}
          {buttons.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-2">
              {buttons.map((b) => (
                <li key={b.label}>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-accent"
                  >
                    {b.label}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {empty && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {c.name} has not added company details yet.
        </p>
      )}

      {c.about && (
        <Card>
          <CardHeader>
            <CardTitle>About {c.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.about}</p>
          </CardContent>
        </Card>
      )}

      {c.mission && (
        <section aria-label="Our core mission" className="rounded-xl border-l-4 border-primary bg-muted/40 p-5">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Our core mission
          </h2>
          <blockquote className="text-lg italic leading-relaxed">“{c.mission}”</blockquote>
        </section>
      )}

      {c.culture.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Culture &amp; principles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-4 sm:grid-cols-2">
              {c.culture.map((item, i) => (
                <li key={i} className="rounded-lg border p-4">
                  <p className="font-medium">{item.title}</p>
                  {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {c.awards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Awards &amp; recognition</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {c.awards.map((a, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 text-sm">
                  <span>
                    <span className="font-medium">{a.title}</span>
                    {a.issuer && <span className="text-muted-foreground"> · {a.issuer}</span>}
                  </span>
                  {a.year && <span className="text-muted-foreground">{a.year}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Open positions ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open positions right now.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {jobs.map((job) => {
                const meta = [
                  job.location,
                  job.workMode && job.workMode[0]!.toUpperCase() + job.workMode.slice(1),
                  job.employmentType && EMPLOYMENT_LABELS[job.employmentType],
                  formatSalary(job.salaryMin, job.salaryMax),
                ].filter(Boolean)
                return (
                  <li key={job.id}>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 transition-colors hover:bg-accent/40"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{job.title}</span>
                        <span className="block text-sm text-muted-foreground">{meta.join(' · ')}</span>
                      </span>
                      {job.applicationDeadline && (
                        <span className="rounded-full border px-2.5 py-0.5 text-xs">
                          {deadlineLabel(job.applicationDeadline)}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {c.benefits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Candidate benefits &amp; perks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {c.benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {c.hubs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Global hubs &amp; remote policy</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {c.hubs.map((h, i) => (
                <li key={i} className="rounded-full border bg-muted/50 px-3 py-1 text-sm">
                  {h}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {socials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Social profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {socials.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-muted-foreground">{hostOf(s.url) + new URL(s.url).pathname.replace(/\/$/, '')}</span>
                  </span>
                  <a
                    href={safeHref(s.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    Visit <ExternalLink className="size-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </article>
  )
}

/** The company name as a link to its page. Sits above a stretched card link (z-10) so both work. */
export function CompanyLink({
  company,
  fallbackName,
}: {
  company: { id: string; name: string } | null | undefined
  fallbackName?: string
}) {
  if (!company) return <>{fallbackName}</>
  return (
    <Link to={`/companies/${company.id}`} className="relative z-10 font-medium hover:underline">
      {company.name}
    </Link>
  )
}
