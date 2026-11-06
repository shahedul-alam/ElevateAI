import { StarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/** The employer's own 1-5 rating. Clicking the current value clears it. */
export function RatingStars({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null
  onChange: (next: number | null) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-pressed={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          onClick={() => onChange(value === n ? null : n)}
        >
          <StarIcon
            className={cn('size-4', value !== null && n <= value ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')}
          />
        </button>
      ))}
    </div>
  )
}
