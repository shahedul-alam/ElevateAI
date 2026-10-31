import { Link, useParams } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatSalary } from '@/features/jobs/format'
import { MatchPanel } from '@/features/matching/match-panel'
import { usePublicJob } from '@/features/jobs/use-jobs'
import { LEADERSHIP_LABELS, LEVEL_LABELS } from '@/features/profile/profile.schema'

export default function JobDetail() {
  const { id = '' } = useParams()
  const job = usePublicJob(id)

  if (job.isPending) return null
  if (job.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          This job is not available. <Link to="/jobs" className="underline">Browse all jobs</Link>
        </p>
      </main>
    )
  }

  const { content: c, termNames, employerName } = job.data
  const name = (termId: string) => termNames[termId] ?? termId
  const salary = formatSalary(c.salaryMin, c.salaryMax)
  const meta = [
    employerName,
    c.location,
    c.workMode && c.workMode[0]!.toUpperCase() + c.workMode.slice(1),
    salary,
  ].filter(Boolean)
  const required = c.skills.filter((s) => s.required)
  const preferred = c.skills.filter((s) => !s.required)

  const skillLine = (s: (typeof c.skills)[number]) =>
    `${name(s.termId)} · ${LEVEL_LABELS[s.minLevel - 1]}${s.minYears ? ` · ${s.minYears}+ yrs` : ''}`

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <Link to="/jobs" className="text-sm text-muted-foreground underline">
          All jobs
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>
      </div>

      <MatchPanel jobId={job.data.id} />

      <Card>
        <CardHeader>
          <CardTitle>About the role</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{c.description}</p>
        </CardContent>
      </Card>

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
            {c.leadershipLevel > 0 && <li>Leadership: {LEADERSHIP_LABELS[c.leadershipLevel]} or above</li>}
            {c.certIds.length > 0 && <li>Certifications: {c.certIds.map(name).join(', ')}</li>}
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
