import { cn } from '@/lib/utils'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/** A person's photo, or their initials when there is none. */
export function PersonAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return src ? (
    <img src={src} alt={`Photo of ${name}`} className={cn('size-12 shrink-0 rounded-lg object-cover', className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground',
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}
