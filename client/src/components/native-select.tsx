import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Plain <select> styled like <Input>. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 dark:[&>option]:bg-background',
        className,
      )}
      {...props}
    />
  )
}
