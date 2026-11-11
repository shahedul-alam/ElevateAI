import type { ApplicationStatus } from '@/features/matching/matching.api'
import { STATUS_LABEL } from './applications.api'

export type StatusHistoryEntry = { fromStatus: ApplicationStatus | null; toStatus: ApplicationStatus; createdAt: string }

/** The one renderer of an application's stage moves, for the candidate list and the employer sheet. */
export function StatusHistory({ history }: { history: StatusHistoryEntry[] }) {
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {history.map((h, i) => (
        <li key={i} className="flex justify-between gap-3">
          <span>
            {h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ` : ''}
            {STATUS_LABEL[h.toStatus]}
          </span>
          <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
        </li>
      ))}
    </ol>
  )
}
