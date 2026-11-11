import { useRef } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/person-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiError } from '@/lib/api'
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from './profile.api'
import { useRemovePhoto, usePhotoUrl, useUploadPhoto } from './use-profile'

/** Optional resume photo. Saved on its own, outside the resume versions, like contact details. */
export function PhotoCard({ name }: { name: string }) {
  const photo = usePhotoUrl()
  const upload = useUploadPhoto()
  const remove = useRemovePhoto()
  const input = useRef<HTMLInputElement>(null)
  const busy = upload.isPending || remove.isPending

  const onPick = (file: File | undefined) => {
    if (input.current) input.current.value = '' // lets the same file be picked again
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) return void toast.error('Use a PNG or JPEG image')
    if (file.size > PHOTO_MAX_BYTES) return void toast.error(`The photo must be under ${PHOTO_MAX_BYTES / 1024} KB`)
    upload.mutate(file, {
      onSuccess: () => toast.success('Photo saved'),
      onError: (err) => toast.error('Could not save photo', { description: getApiError(err).message }),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photo</CardTitle>
        <CardDescription>
          Optional. It appears on your resume and is sent to employers you apply to, as it is when you apply.
          It is not part of your resume versions and never affects your match score.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <PersonAvatar name={name} src={photo.data} className="size-24" />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              ref={input}
              id="resume-photo"
              type="file"
              accept={PHOTO_TYPES.join(',')}
              className="sr-only"
              disabled={busy}
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            <Button asChild variant="outline" size="sm" aria-disabled={busy}>
              <label htmlFor="resume-photo" className="cursor-pointer">
                {upload.isPending ? 'Uploading...' : photo.data ? 'Change photo' : 'Choose photo'}
              </label>
            </Button>
            {photo.data && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => toast.success('Photo removed'),
                    onError: (err) => toast.error('Could not remove photo', { description: getApiError(err).message }),
                  })
                }
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG or JPEG, up to 512 KB.</p>
        </div>
      </CardContent>
    </Card>
  )
}
