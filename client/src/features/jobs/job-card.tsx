import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Card, CardContent } from '@/components/ui/card'
import { CompanyLogo } from '@/features/company/company-logo'
import { CompanyLink } from '@/features/company/company-profile-view'
import type { CompanyRef } from '@/features/company/company.schema'
import { formatSalary } from '@/features/jobs/format'
import { EMPLOYMENT_LABELS, type EmploymentType } from '@/features/jobs/jobs.schema'

export type JobCardData = {
  id: string
  title: string
  employerName: string
  company: CompanyRef | null
  location?: string
  workMode?: string
  employmentType?: EmploymentType
  salaryMin?: number
  salaryMax?: number
  domainId?: string
  skillIds: string[]
}

type Props = {
  job: JobCardData
  names: Record<string, string>
  /** Match score in percent, shown on the right. */
  score?: number
  /** Shown above the score (e.g. an application stage badge). */
  badge?: ReactNode
  /** Small muted line under the skills. */
  footer?: ReactNode
  /** False renders a plain title (the job is no longer public). */
  linkable?: boolean
}

/** The one job card used by the job list, recommendations and the candidate's applications. */
export function JobCard({ job, names, score, badge, footer, linkable = true }: Props) {
  const meta = [
    job.location,
    job.workMode && job.workMode[0]!.toUpperCase() + job.workMode.slice(1),
    job.employmentType && EMPLOYMENT_LABELS[job.employmentType],
    job.domainId && names[job.domainId],
    formatSalary(job.salaryMin, job.salaryMax),
  ].filter(Boolean)

  return (
    // The title link stretches over the whole card; the company link sits above it.
    <Card
      className={`relative transition-colors ${linkable ? 'focus-within:ring-2 focus-within:ring-ring/50 hover:bg-accent/40' : ''}`}
    >
      <CardContent className="flex gap-3">
        {job.company && (
          <CompanyLogo id={job.company.id} name={job.company.name} logoUrl={job.company.logoUrl} className="size-11" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {linkable ? (
            <Link
              to={`/jobs/${job.id}`}
              className="font-medium outline-none after:absolute after:inset-0 after:content-['']"
            >
              {job.title}
            </Link>
          ) : (
            <p className="font-medium">{job.title}</p>
          )}
          <p className="text-sm text-muted-foreground">
            <CompanyLink company={job.company} fallbackName={job.employerName} />
            {meta.length > 0 && ` · ${meta.join(' · ')}`}
          </p>
          {job.skillIds.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {job.skillIds.map((id) => (
                <li key={id} className="rounded-full border px-2.5 py-0.5 text-xs">
                  {names[id] ?? id}
                </li>
              ))}
            </ul>
          )}
          {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
        </div>
        {(badge || score !== undefined) && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {badge}
            {score !== undefined && (
              <p className="text-lg font-semibold tabular-nums" aria-label={`Match score ${score} percent`}>
                {score}%
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
