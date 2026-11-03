import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { FieldError } from '@/components/field-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** A card holding rows the user builds with an Add button. The caller owns the form state. */
export function ListCard({
  title,
  description,
  count,
  max,
  error,
  onAdd,
  children,
}: {
  title: string
  description?: string
  count: number
  max: number
  error?: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {children}
        <FieldError message={error} />
        <div>
          <Button type="button" variant="outline" size="sm" disabled={count >= max} onClick={onAdd}>
            <Plus /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** One row of a ListCard: the inputs plus a remove button. */
export function ListRow({
  label,
  onRemove,
  children,
}: {
  label: string
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">{children}</div>
      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  )
}
