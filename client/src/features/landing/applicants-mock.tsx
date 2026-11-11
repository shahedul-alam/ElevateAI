const SAMPLE = [
  { name: 'Applicant A', score: 91, stage: 'Technical interview', note: 'Seven years in React and TypeScript; led a team of four.' },
  { name: 'Applicant B', score: 84, stage: 'Under review', note: 'Five years in a related domain; one required certification missing.' },
  { name: 'Applicant C', score: 72, stage: 'Applied', note: 'Strong skills match with less experience than requested.' },
]

/** Static sample of the employer's ranked applicant list; names and numbers are made up. */
export function ApplicantsMock() {
  return (
    <figure className="mt-6 rounded-xl border bg-muted/40 p-3" aria-label="Sample ranked applicant list">
      <figcaption className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Sample applicants, ranked by match
      </figcaption>
      <ol className="space-y-2">
        {SAMPLE.map((a, i) => (
          <li key={a.name} className="flex gap-3 rounded-lg border bg-card p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold tabular-nums text-brand">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-sm font-semibold tabular-nums">{a.score}%</p>
              </div>
              <p className="text-xs text-muted-foreground">{a.stage}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  )
}
