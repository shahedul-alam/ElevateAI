import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProfileVersion } from './profile.api'
import { useVersions } from './use-profile'

const summarize = (v: ProfileVersion) => {
  const years = v.content.roles.reduce((sum, r) => sum + r.years, 0)
  return `${v.content.skills.length} skills · ${v.content.roles.length} roles · ${Math.round(years * 10) / 10} yrs`
}

type Props = {
  onRestore: (version: ProfileVersion) => void
  restoring: boolean
  /** Unsaved edits would be replaced by a restore. */
  hasUnsavedChanges: boolean
}

export function VersionHistory({ onRestore, restoring, hasUnsavedChanges }: Props) {
  const { data, isPending, isError } = useVersions()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
        <CardDescription>
          Every distinct save is kept. Restoring a version brings back its exact content, so it
          matches jobs with the same scores as before.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load versions.</p>
        ) : data.versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet. Save your resume to create the first.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {new Date(v.createdAt).toLocaleString()}
                    {v.isCurrent && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{summarize(v)}</p>
                </div>
                {!v.isCurrent && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={restoring}
                    onClick={() => {
                      if (
                        hasUnsavedChanges &&
                        !window.confirm('You have unsaved changes. Restoring will discard them.')
                      )
                        return
                      onRestore(v)
                    }}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
