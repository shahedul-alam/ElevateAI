import { Download, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/auth.store'
import { usePhotoDataUrl, usePhotoUrl, useProfile, useVersions } from '@/features/profile/use-profile'
import { buildResumeModel, hasPdfUnsupportedChars, resumeFilename } from '@/features/resume/resume-model'
import { ResumeSheet } from '@/features/resume/resume-view'

export default function ResumePreview() {
  return (
    <RequireRole role="candidate" message="The resume preview is for candidate accounts.">
      <PreviewPage />
    </RequireRole>
  )
}

const dateTime = (iso: string) => new Date(iso).toLocaleString()

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function PreviewPage() {
  const [params, setParams] = useSearchParams()
  const requestedId = params.get('version')
  const profile = useProfile()
  const versions = useVersions()
  const user = useAuthStore((s) => s.user)
  const [downloading, setDownloading] = useState(false)
  // Photos are not versioned, so every version is shown with the current one.
  const photoUrl = usePhotoUrl()
  const photo = usePhotoDataUrl(photoUrl.data)
  const photoLoading = photoUrl.isPending || photo.isPending && !!photoUrl.data

  if (profile.isPending) return null
  const current = profile.data
  if (!current) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          You have not saved a resume yet.{' '}
          <Link to="/resume" className="underline">
            Build your resume
          </Link>
        </p>
      </main>
    )
  }

  const viewingOlder = !!requestedId && requestedId !== current.id
  let content = current.content
  let termNames = current.termNames
  let savedAt = current.createdAt

  if (viewingOlder) {
    if (versions.isPending) return null
    const version = versions.data?.versions.find((v) => v.id === requestedId)
    if (!version) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-12">
          <p className="text-muted-foreground">
            That version was not found.{' '}
            <Link to="/resume/preview" className="underline">
              View your current resume
            </Link>
          </p>
        </main>
      )
    }
    content = version.content
    termNames = { ...current.termNames, ...versions.data?.termNames }
    savedAt = version.createdAt
  }

  const model = buildResumeModel({
    name: user?.name ?? '',
    accountEmail: user?.email ?? '',
    content,
    // Contact is not versioned: every version is shown with the current details.
    contact: current.contact,
    termNames,
    photo: photo.data,
  })

  const onDownload = async () => {
    setDownloading(true)
    try {
      // The PDF library is large, so it loads only when someone downloads.
      const { downloadResumePdf } = await import('@/features/resume/resume-pdf')
      await downloadResumePdf(model, resumeFilename(user?.name ?? '', viewingOlder ? savedAt : undefined))
    } catch {
      toast.error('Could not create the PDF', { description: 'Try again in a moment.' })
    } finally {
      setDownloading(false)
    }
  }

  const onSelectVersion = (id: string) => {
    const next = new URLSearchParams(params)
    if (id === current.id) next.delete('version')
    else next.set('version', id)
    setParams(next)
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resume preview</h1>
          <p className="text-sm text-muted-foreground">This is how your resume reads in the downloaded PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onDownload} disabled={downloading || photoLoading}>
            <Download className="size-4" />
            {downloading ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
          <Button variant="outline" asChild>
            <Link to={viewingOlder ? `/resume?from=${requestedId}` : '/resume'}>
              <Pencil className="size-4" />
              {viewingOlder ? 'Edit a copy of this version' : 'Edit'}
            </Link>
          </Button>
          {viewingOlder && (
            <Button variant="ghost" asChild>
              <Link to="/resume">Back to editor</Link>
            </Button>
          )}
        </div>
      </div>

      {versions.data && versions.data.versions.length > 1 && (
        <div className="flex max-w-sm flex-col gap-1">
          <label htmlFor="version" className="text-sm font-medium">
            Version
          </label>
          <NativeSelect
            id="version"
            value={viewingOlder ? requestedId : current.id}
            onChange={(e) => onSelectVersion(e.target.value)}
          >
            {versions.data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {dateTime(v.createdAt)}
                {v.id === current.id ? ' (current)' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {viewingOlder && (
        <Notice>
          You are viewing the version saved on {dateTime(savedAt)}. Your contact details always show your
          latest information, whichever version you view.
        </Notice>
      )}

      {hasPdfUnsupportedChars(model) && (
        <Notice>
          Your resume contains characters outside the Latin alphabet. They will show on this page but may not
          appear in the PDF.
        </Notice>
      )}

      <ResumeSheet model={model} />
    </main>
  )
}
