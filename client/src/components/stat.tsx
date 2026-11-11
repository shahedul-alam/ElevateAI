import { Link } from 'react-router'

import { Card, CardContent } from '@/components/ui/card'

/** A number with a label; a link when `to` is given. Used by the admin and candidate dashboards. */
export function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <Card className={to ? 'transition-colors hover:bg-accent/40' : undefined}>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}
