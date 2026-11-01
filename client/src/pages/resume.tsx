import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
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
import type { ProfileVersion } from '@/features/profile/profile.api'
import {
  DEGREE_LABELS,
  LEADERSHIP_LABELS,
  LEVEL_LABELS,
  WORK_MODES,
  emptyForm,
  profileFormSchema,
  toForm,
  toPayload,
  type ProfileFormValues,
} from '@/features/profile/profile.schema'
import { useProfile, useRestoreVersion, useSaveProfile } from '@/features/profile/use-profile'
import { VersionHistory } from '@/features/profile/version-history'
import { getApiError } from '@/lib/api'

const textareaClass =
  'min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30'

export default function Resume() {
  return (
    <RequireRole role="candidate" message="The resume builder is for candidate accounts.">
      <ResumeBuilder />
    </RequireRole>
  )
}

function ResumeBuilder() {
  const profile = useProfile()
  const save = useSaveProfile()
  const restore = useRestoreVersion()
  // Names of terms picked this session; the rest come with the loaded profile.
  const [picked, setPicked] = useState<Record<string, string>>({})
  const names = { ...profile.data?.termNames, ...picked }

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
    getValues,
    control,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: emptyForm,
  })
  const skills = useFieldArray({ control, name: 'skills' })
  const roles = useFieldArray({ control, name: 'roles' })
  const education = useFieldArray({ control, name: 'education' })
  const certIds = useWatch({ control, name: 'certIds' })

  // Load (or reload after a save/restore) the current version into the form.
  useEffect(() => {
    if (profile.data) reset(toForm(profile.data.content))
  }, [profile.data, reset])

  const remember = (id: string, name: string) => setPicked((n) => ({ ...n, [id]: name }))

  const onSubmit = (values: ProfileFormValues) => {
    save.mutate(toPayload(values), {
      onSuccess: () => {
        // Clears "unsaved" even when the content matched an existing version (no refetch change).
        reset(values)
        toast.success('Resume saved')
      },
      onError: (err) => toast.error('Could not save', { description: getApiError(err).message }),
    })
  }

  const onRestore = (version: ProfileVersion) => {
    restore.mutate(version.id, {
      onSuccess: () => toast.success('Version restored'),
      onError: (err) => toast.error('Could not restore', { description: getApiError(err).message }),
    })
  }

  const addUnmapped = (text: string) => {
    const current = getValues('unmappedText').trim()
    setValue('unmappedText', current ? `${current}, ${text}` : text, { shouldDirty: true })
  }

  if (profile.isPending) return null

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your resume</h1>
          <p className="text-sm text-muted-foreground">
            Matching scores are calculated from exactly what you enter here.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Headline and summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="headline">Short professional headline</Label>
            <Input id="headline" placeholder="e.g. Full-stack engineer" {...register('headline')} />
            <FieldError message={errors.headline?.message} />
            <Label htmlFor="summary" className="mt-2">
              Summary
            </Label>
            <textarea
              id="summary"
              className={textareaClass}
              placeholder="A few lines about your background and what you are looking for"
              aria-invalid={!!errors.summary}
              {...register('summary')}
            />
            <FieldError message={errors.summary?.message} />
          </CardContent>
        </Card>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>Pick from the list so equivalent names score the same.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CatalogPicker
              kind="skill"
              placeholder="Search skills..."
              excludeIds={skills.fields.map((f) => f.termId)}
              onSelect={(t) => {
                remember(t.id, t.name)
                skills.append({ termId: t.id, level: 3, years: 1 })
              }}
              onFreeText={addUnmapped}
            />
            {skills.fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-[1fr_8rem_5rem_auto] items-start gap-2">
                <p className="pt-1.5 text-sm font-medium">{names[field.termId] ?? field.termId}</p>
                <NativeSelect
                  aria-label={`${names[field.termId] ?? 'Skill'} level`}
                  {...register(`skills.${i}.level`, { valueAsNumber: true })}
                >
                  {LEVEL_LABELS.map((label, idx) => (
                    <option key={label} value={idx + 1}>
                      {idx + 1} · {label}
                    </option>
                  ))}
                </NativeSelect>
                <div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    aria-label={`${names[field.termId] ?? 'Skill'} years`}
                    aria-invalid={!!errors.skills?.[i]?.years}
                    {...register(`skills.${i}.years`, { valueAsNumber: true })}
                  />
                  <FieldError message={errors.skills?.[i]?.years?.message} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${names[field.termId] ?? 'skill'}`}
                  onClick={() => skills.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {skills.fields.length > 0 && (
              <p className="text-xs text-muted-foreground">Columns: skill, level, years of use.</p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="unmapped">Other skills (not scored yet)</Label>
              <Input id="unmapped" placeholder="Comma separated" {...register('unmappedText')} />
              <FieldError message={errors.unmappedText?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Experience</CardTitle>
            <CardDescription>
              The years you enter drive your score: total experience is their sum. Company, dates and
              the description are shown to employers but are not scored.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {roles.fields.map((field, i) => (
              <div key={field.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_12rem_5rem_auto]">
                  <div>
                    <Input
                      placeholder="Role title"
                      aria-label="Role title"
                      aria-invalid={!!errors.roles?.[i]?.title}
                      {...register(`roles.${i}.title`)}
                    />
                    <FieldError message={errors.roles?.[i]?.title?.message} />
                  </div>
                  <NativeSelect aria-label="Role domain" {...register(`roles.${i}.domainId`)}>
                    <option value="">No domain</option>
                    {(domains.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <div>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      aria-label="Role years"
                      aria-invalid={!!errors.roles?.[i]?.years}
                      {...register(`roles.${i}.years`, { valueAsNumber: true })}
                    />
                    <FieldError message={errors.roles?.[i]?.years?.message} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove role"
                    onClick={() => roles.remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Input
                      placeholder="Company"
                      aria-label="Role company"
                      {...register(`roles.${i}.company`)}
                    />
                    <FieldError message={errors.roles?.[i]?.company?.message} />
                  </div>
                  <div>
                    <Input
                      placeholder="Dates, e.g. Jan 2021 - Mar 2024"
                      aria-label="Role period"
                      {...register(`roles.${i}.period`)}
                    />
                    <FieldError message={errors.roles?.[i]?.period?.message} />
                  </div>
                </div>
                <textarea
                  className={textareaClass}
                  placeholder="What you did and achieved in this role"
                  aria-label="Role description"
                  aria-invalid={!!errors.roles?.[i]?.description}
                  {...register(`roles.${i}.description`)}
                />
                <FieldError message={errors.roles?.[i]?.description?.message} />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() =>
                roles.append({ title: '', years: 1, domainId: '', company: '', period: '', description: '' })
              }
            >
              Add role
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
            <CardDescription>
              Your highest degree counts toward your score when a job asks for one. Field, institution
              and dates are shown to employers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {education.fields.map((field, i) => (
              <div key={field.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[12rem_1fr_auto]">
                  <NativeSelect
                    aria-label="Degree"
                    {...register(`education.${i}.degreeLevel`, { valueAsNumber: true })}
                  >
                    {DEGREE_LABELS.map((label, level) =>
                      level === 0 ? null : (
                        <option key={label} value={level}>
                          {label}
                        </option>
                      ),
                    )}
                  </NativeSelect>
                  <Input
                    placeholder="Field of study"
                    aria-label="Field of study"
                    {...register(`education.${i}.field`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove education"
                    onClick={() => education.remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Institution"
                    aria-label="Institution"
                    {...register(`education.${i}.institution`)}
                  />
                  <Input
                    placeholder="Dates, e.g. 2015 - 2019"
                    aria-label="Education period"
                    {...register(`education.${i}.period`)}
                  />
                </div>
                <FieldError
                  message={
                    errors.education?.[i]?.field?.message ??
                    errors.education?.[i]?.institution?.message ??
                    errors.education?.[i]?.period?.message
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => education.append({ degreeLevel: 2, field: '', institution: '', period: '' })}
            >
              Add education
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Leadership and certifications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="leadership">Highest leadership level</Label>
              <NativeSelect
                id="leadership"
                {...register('leadershipLevel', { valueAsNumber: true })}
              >
                {LEADERSHIP_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cert-search">Certifications</Label>
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
                  {certIds.map((id) => (
                    <li
                      key={id}
                      className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                    >
                      {names[id] ?? id}
                      <button
                        type="button"
                        aria-label={`Remove ${names[id] ?? id}`}
                        onClick={() =>
                          setValue(
                            'certIds',
                            certIds.filter((c) => c !== id),
                            { shouldDirty: true },
                          )
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

        <Card>
          <CardHeader>
            <CardTitle>Job preferences</CardTitle>
            <CardDescription>
              Shown as eligibility notes next to a job. They never change your match score.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="locations">Preferred locations</Label>
              <Input id="locations" placeholder="Comma separated" {...register('locationsText')} />
              <FieldError message={errors.locationsText?.message} />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Work mode</legend>
              <div className="flex gap-4">
                {WORK_MODES.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm capitalize">
                    <input type="checkbox" value={mode} {...register('workModes')} />
                    {mode}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="salary">Minimum salary (per year)</Label>
              <Input id="salary" inputMode="numeric" {...register('minSalary')} />
              <FieldError message={errors.minSalary?.message} />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save resume'}
          </Button>
          {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        </div>
      </form>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <VersionHistory
          onRestore={onRestore}
          restoring={restore.isPending}
          hasUnsavedChanges={isDirty}
        />
      </aside>
    </main>
  )
}
