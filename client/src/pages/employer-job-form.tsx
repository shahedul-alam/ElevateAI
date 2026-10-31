import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { FieldError } from '@/components/field-error'
import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchCatalog } from '@/features/catalog/catalog.api'
import { CatalogPicker } from '@/features/catalog/catalog-picker'
import {
  emptyJobForm,
  jobFormSchema,
  toJobForm,
  toJobPayload,
  type JobFormValues,
} from '@/features/jobs/jobs.schema'
import { useCreateJob, useMyJob, useUpdateJob } from '@/features/jobs/use-jobs'
import {
  LEADERSHIP_LABELS,
  LEVEL_LABELS,
  WORK_MODES,
} from '@/features/profile/profile.schema'
import { getApiError } from '@/lib/api'

export default function EmployerJobForm() {
  return (
    <RequireRole role="employer" message="Posting jobs is for employer accounts.">
      <JobFormPage />
    </RequireRole>
  )
}

const textareaClass =
  'min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30'

function JobFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const job = useMyJob(id)
  const create = useCreateJob()
  const update = useUpdateJob()
  // Names of terms picked this session; the rest come with the loaded job.
  const [picked, setPicked] = useState<Record<string, string>>({})
  const names = { ...job.data?.termNames, ...picked }

  const domains = useQuery({
    queryKey: ['catalog', 'domain', 'all'],
    queryFn: () => searchCatalog('domain', '', 50),
    staleTime: 5 * 60_000,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: emptyJobForm,
  })
  const skills = useFieldArray({ control, name: 'skills' })
  const certIds = useWatch({ control, name: 'certIds' })

  useEffect(() => {
    if (job.data) reset(toJobForm(job.data.content))
  }, [job.data, reset])

  const remember = (termId: string, name: string) => setPicked((n) => ({ ...n, [termId]: name }))
  const saving = create.isPending || update.isPending
  const closed = job.data?.status === 'closed'

  const onSubmit = (values: JobFormValues) => {
    const content = toJobPayload(values)
    const onError = (err: unknown) =>
      toast.error('Could not save', { description: getApiError(err).message })

    if (id) {
      update.mutate(
        { id, content },
        {
          onSuccess: () => {
            reset(values)
            toast.success('Job saved')
          },
          onError,
        },
      )
    } else {
      create.mutate(content, {
        onSuccess: () => {
          toast.success('Draft created', { description: 'Publish it from your jobs list when ready.' })
          navigate('/employer/jobs')
        },
        onError,
      })
    }
  }

  if (id && job.isPending) return null
  if (id && job.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          That job was not found. <Link to="/employer/jobs" className="underline">Back to your jobs</Link>
        </p>
      </main>
    )
  }

  const skillName = (termId: string) => names[termId] ?? termId

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{id ? 'Edit job' : 'Post a job'}</h1>
          <p className="text-sm text-muted-foreground">
            Candidates are scored against the requirements below, so be specific.
          </p>
          {closed && (
            <p role="status" className="mt-2 text-sm text-destructive">
              This job is closed and can no longer be edited.
            </p>
          )}
        </div>

        <fieldset disabled={closed} className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" aria-invalid={!!errors.title} {...register('title')} />
                <FieldError message={errors.title?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className={textareaClass}
                  aria-invalid={!!errors.description}
                  {...register('description')}
                />
                <FieldError message={errors.description?.message} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" {...register('location')} />
                  <FieldError message={errors.location?.message} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="workMode">Work mode</Label>
                  <NativeSelect id="workMode" {...register('workMode')}>
                    <option value="">Not specified</option>
                    {WORK_MODES.map((m) => (
                      <option key={m} value={m} className="capitalize">
                        {m}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="salaryMin">Minimum salary (per year)</Label>
                  <Input id="salaryMin" inputMode="numeric" {...register('salaryMin')} />
                  <FieldError message={errors.salaryMin?.message} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="salaryMax">Maximum salary (per year)</Label>
                  <Input id="salaryMax" inputMode="numeric" {...register('salaryMax')} />
                  <FieldError message={errors.salaryMax?.message} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
              <CardDescription>
                Required skills count double. Level is the minimum proficiency you expect.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CatalogPicker
                kind="skill"
                placeholder="Search skills..."
                excludeIds={skills.fields.map((f) => f.termId)}
                onSelect={(t) => {
                  remember(t.id, t.name)
                  skills.append({ termId: t.id, required: true, minLevel: 3, minYears: '' })
                }}
              />
              {skills.fields.map((field, i) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[1fr_6rem_9rem_5rem_auto]"
                >
                  <p className="pt-1.5 text-sm font-medium">{skillName(field.termId)}</p>
                  <label className="flex items-center gap-2 pt-1.5 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`${skillName(field.termId)} required`}
                      {...register(`skills.${i}.required`)}
                    />
                    Required
                  </label>
                  <NativeSelect
                    aria-label={`${skillName(field.termId)} minimum level`}
                    {...register(`skills.${i}.minLevel`, { valueAsNumber: true })}
                  >
                    {LEVEL_LABELS.map((label, idx) => (
                      <option key={label} value={idx + 1}>
                        {idx + 1} · {label}
                      </option>
                    ))}
                  </NativeSelect>
                  <div>
                    <Input
                      inputMode="decimal"
                      placeholder="Yrs"
                      aria-label={`${skillName(field.termId)} minimum years`}
                      aria-invalid={!!errors.skills?.[i]?.minYears}
                      {...register(`skills.${i}.minYears`)}
                    />
                    <FieldError message={errors.skills?.[i]?.minYears?.message} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${skillName(field.termId)}`}
                    onClick={() => skills.remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {skills.fields.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Columns: skill, required, minimum level, minimum years (optional).
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Experience and credentials</CardTitle>
              <CardDescription>Leave a field at 0 or empty to leave it out of the score.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="minYears">Minimum total experience (years)</Label>
                <Input
                  id="minYears"
                  type="number"
                  step="0.5"
                  min="0"
                  aria-invalid={!!errors.minYears}
                  {...register('minYears', { valueAsNumber: true })}
                />
                <FieldError message={errors.minYears?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="leadership">Leadership level</Label>
                <NativeSelect id="leadership" {...register('leadershipLevel', { valueAsNumber: true })}>
                  {LEADERSHIP_LABELS.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="domain">Industry domain</Label>
                <NativeSelect id="domain" {...register('domainId')}>
                  <option value="">Not specified</option>
                  {(domains.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="minDomainYears">Minimum years in that domain</Label>
                <Input
                  id="minDomainYears"
                  type="number"
                  step="0.5"
                  min="0"
                  aria-invalid={!!errors.minDomainYears}
                  {...register('minDomainYears', { valueAsNumber: true })}
                />
                <FieldError message={errors.minDomainYears?.message} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="cert-search">Required certifications</Label>
                <CatalogPicker
                  id="cert-search"
                  kind="certification"
                  placeholder="Search certifications..."
                  excludeIds={certIds}
                  onSelect={(t) => {
                    remember(t.id, t.name)
                    setValue('certIds', [...certIds, t.id], { shouldDirty: true })
                  }}
                />
                {certIds.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {certIds.map((cid) => (
                      <li key={cid} className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                        {names[cid] ?? cid}
                        <button
                          type="button"
                          aria-label={`Remove ${names[cid] ?? cid}`}
                          onClick={() =>
                            setValue('certIds', certIds.filter((c) => c !== cid), { shouldDirty: true })
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || closed}>
            {saving ? 'Saving...' : id ? 'Save changes' : 'Create draft'}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/employer/jobs">Back to jobs</Link>
          </Button>
          {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        </div>
      </form>
    </main>
  )
}
