import {
  Chart as ChartJS,
  Filler,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'

import type { Breakdown, DimensionKey, EligibilityStatus } from './matching.api'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip)

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  skills: 'Skills',
  experience: 'Experience',
  domain: 'Industry',
  leadership: 'Leadership',
  certifications: 'Certifications',
}

const ELIGIBILITY_LABEL = {
  location: 'Location',
  workMode: 'Work mode',
  salary: 'Salary',
} as const

const ELIGIBILITY_TEXT: Record<EligibilityStatus, string> = {
  ok: 'fits your preferences',
  mismatch: "doesn't match your preferences",
  unknown: 'not enough information',
}

// Neutral tones read on both light and dark backgrounds, which a canvas cannot theme via CSS.
const LINE = 'rgb(59 130 246)'
const FILL = 'rgb(59 130 246 / 0.2)'
const GRID = 'rgb(128 128 128 / 0.35)'
const TEXT = 'rgb(128 128 128)'

type Props = Breakdown & {
  /** The radar needs at least three axes to be meaningful. */
  showRadar?: boolean
  /** Eligibility notes are phrased for the candidate, so employer views turn them off. */
  showEligibility?: boolean
  /** Prefix for the chart's accessible name, e.g. "Your match". */
  label: string
}

export function MatchBreakdown({ dimensions, missing, eligibility, showRadar = true, showEligibility = true, label }: Props) {
  const applicable = dimensions.filter((d) => d.applicable)
  const requiredMissing = missing.skills.filter((s) => s.required)
  const preferredMissing = missing.skills.filter((s) => !s.required)
  const mismatches = (Object.keys(ELIGIBILITY_LABEL) as (keyof typeof ELIGIBILITY_LABEL)[]).filter(
    (k) => eligibility[k] === 'mismatch',
  )

  return (
    <div className="flex flex-col gap-5">
      {showRadar && applicable.length >= 3 && (
        <div className="mx-auto w-full max-w-xs">
          <Radar
            role="img"
            aria-label={`${label}: ${applicable.map((d) => `${DIMENSION_LABEL[d.key]} ${d.score}`).join(', ')}`}
            data={{
              labels: applicable.map((d) => DIMENSION_LABEL[d.key]),
              datasets: [
                {
                  data: applicable.map((d) => d.score),
                  borderColor: LINE,
                  backgroundColor: FILL,
                  pointBackgroundColor: LINE,
                  borderWidth: 2,
                },
              ],
            }}
            options={{
              scales: {
                r: {
                  min: 0,
                  max: 100,
                  ticks: { stepSize: 25, display: false },
                  grid: { color: GRID },
                  angleLines: { color: GRID },
                  pointLabels: { color: TEXT, font: { size: 12 } },
                },
              },
              plugins: { legend: { display: false } },
            }}
          />
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {applicable.map((d) => (
          <li key={d.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{DIMENSION_LABEL[d.key]}</span>
              <span className="tabular-nums text-muted-foreground">{d.score}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={DIMENSION_LABEL[d.key]}
              aria-valuenow={d.score}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${d.score}%` }} />
            </div>
          </li>
        ))}
      </ul>

      {(missing.skills.length > 0 || missing.certs.length > 0) && (
        <section className="text-sm">
          <h3 className="mb-1 font-medium">Gaps to close</h3>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {requiredMissing.length > 0 && (
              <li>Required skills: {requiredMissing.map((s) => s.name).join(', ')}</li>
            )}
            {preferredMissing.length > 0 && (
              <li>Preferred skills: {preferredMissing.map((s) => s.name).join(', ')}</li>
            )}
            {missing.certs.length > 0 && (
              <li>Certifications: {missing.certs.map((c) => c.name).join(', ')}</li>
            )}
          </ul>
        </section>
      )}

      {showEligibility && mismatches.length > 0 && (
        <section className="text-sm">
          <h3 className="mb-1 font-medium">Worth checking</h3>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {mismatches.map((k) => (
              <li key={k}>
                {ELIGIBILITY_LABEL[k]} {ELIGIBILITY_TEXT[eligibility[k]]}. This does not change your score.
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
