import { cn } from '@/lib/utils'

/** A stable hue per company, so the generated logo and cover look the same everywhere. */
export function hueFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'

/** The uploaded logo, or generated initials when the company has not uploaded one. */
export function CompanyLogo({
  id,
  name,
  logoUrl,
  className,
}: {
  id: string
  name: string
  logoUrl: string | null
  className?: string
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn('size-10 shrink-0 rounded-lg border bg-white object-contain', className)}
      />
    )
  }
  const hue = hueFor(id || name)
  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 42%), hsl(${(hue + 40) % 360} 60% 32%))` }}
      className={cn(
        'flex size-10 shrink-0 select-none items-center justify-center rounded-lg font-semibold text-white',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/** The uploaded cover, or a generated gradient. */
export function CompanyCover({
  id,
  name,
  coverUrl,
  className,
}: {
  id: string
  name: string
  coverUrl: string | null
  className?: string
}) {
  if (coverUrl) {
    return <img src={coverUrl} alt="" className={cn('w-full object-cover', className)} />
  }
  const hue = hueFor(id || name)
  return (
    <div
      aria-hidden
      style={{
        background: `linear-gradient(120deg, hsl(${hue} 55% 38%), hsl(${(hue + 60) % 360} 60% 28%) 60%, hsl(${(hue + 120) % 360} 55% 24%))`,
      }}
      className={cn('w-full', className)}
    />
  )
}
