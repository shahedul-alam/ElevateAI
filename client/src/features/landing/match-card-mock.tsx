import { ArrowUpRight } from 'lucide-react'

import { WEIGHTS } from './weights'

const SCORE = Math.round(WEIGHTS.reduce((sum, d) => sum + (d.weight * d.sample) / 100, 0))
const R = 42
const LEN = 2 * Math.PI * R

export function MatchCardMock() {
  return (
    <figure
      className="rounded-2xl border bg-card p-5 sm:p-6"
      aria-label={`Sample match card: ${SCORE} percent match for a Senior Frontend Engineer role`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sample match</p>
          <p className="mt-1 text-lg font-semibold leading-tight">Senior Frontend Engineer</p>
          <p className="text-sm text-muted-foreground">Remote · Full time</p>
        </div>
        <div className="relative size-24 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-muted" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              className="stroke-brand motion-safe:animate-[fill-ring_1.2s_ease-out]"
              style={{
                ['--ring-len' as string]: LEN,
                strokeDasharray: LEN,
                strokeDashoffset: LEN * (1 - SCORE / 100),
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">{SCORE}</span>
            <span className="-mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">of 100</span>
          </div>
        </div>
      </div>

      <ul className="mt-6 space-y-3" aria-hidden="true">
        {WEIGHTS.map((d, i) => (
          <li key={d.label} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{d.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full origin-left rounded-full bg-brand motion-safe:animate-[grow-x_0.9s_ease-out_backwards]"
                style={{ width: `${d.sample}%`, animationDelay: `${i * 80}ms` }}
              />
            </span>
            <span className="text-right tabular-nums">{d.sample}</span>
          </li>
        ))}
      </ul>

      <figcaption className="mt-6 flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-sm">
        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <span>
          <strong className="font-medium">Biggest lift:</strong> a cloud certification would add about 6 points.
        </span>
      </figcaption>
    </figure>
  )
}
