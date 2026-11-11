import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Eye, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { FieldError } from '@/components/field-error'
import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/features/auth/auth.store'
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
import { useProfile, useRestoreVersion, useSaveProfile, useVersions } from '@/features/profile/use-profile'
import { EvaluationCard } from '@/features/profile/evaluation-card'
import { ImportCard } from '@/features/profile/import-card'
import { PhotoCard } from '@/features/profile/photo-card'
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
  const versions = useVersions()
  const accountEmail = useAuthStore((s) => s.user?.email ?? '')
  const accountName = useAuthStore((s) => s.user?.name ?? '')
  const save = useSaveProfile()
  const restore = useRestoreVersion()
  const [params, setParams] = useSearchParams()
  // `?from=<version id>` starts an edit from an older version (a copy: nothing changes until Save).
  const fromId = params.get('from')
  const copySource = fromId ? versions.data?.versions.find((v) => v.id === fromId) : undefined
  const appliedFrom = useRef<string | null>(null)
  // Names of terms picked this session; the rest come with the loaded profile (and the version history).
  const [picked, setPicked] = useState<Record<string, string>>({})
  const names = { ...profile.data?.termNames, ...(fromId ? versions.data?.termNames : undefined), ...picked }

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
  const hasContent = skills.fields.length + roles.fields.length + education.fields.length + (certIds?.length ?? 0) > 0

  // Load the current version into the form, and reload it after a save/restore. When editing a copy
  // of an older version, load that once and then leave the form alone, so a background refetch
  // can never overwrite what is being edited.
  useEffect(() => {
    if (!profile.data) return
    if (fromId) {
      if (versions.isPending) return
      if (appliedFrom.current !== fromId) {
        appliedFrom.current = fromId
        const source = versions.data?.versions.find((v) => v.id === fromId)
        if (source) {
          reset(toForm(source.content, profile.data.contact))
        } else {
          toast.error('That version was not found', { description: 'Showing your current resume instead.' })
          setParams({}, { replace: true })
        }
      }
      return
    }
    appliedFrom.current = null
    reset(toForm(profile.data.content, profile.data.contact))
  }, [profile.data, fromId, versions.data, versions.isPending, reset, setParams])

  const remember = (id: string, name: string) => setPicked((n) => ({ ...n, [id]: name }))

  const onSubmit = (values: ProfileFormValues) => {
    save.mutate(toPayload(values), {
      onSuccess: () => {
        // Clears "unsaved" even when the content matched an existing version (no refetch change).
        reset(values)
        // The copy is now the current resume, so the form follows the server again.
        if (fromId) setParams({}, { replace: true })
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your resume</h1>
            <p className="text-sm text-muted-foreground">
              Matching scores are calculated from exactly what you enter here.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button variant="outline" asChild>
              <Link to="/resume/preview">
                <Eye className="size-4" />
                Preview &amp; download
              </Link>
            </Button>
            {isDirty && <p className="text-xs text-muted-foreground">The preview shows your last saved resume.</p>}
          </div>
        </div>

        {fromId && copySource && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            You are editing a copy of the version saved on {new Date(copySource.createdAt).toLocaleString()}.
            Saving creates a new version; your current resume stays as it is until then.{' '}
            <button type="button" className="underline" onClick={() => setParams({}, { replace: true })}>
              Discard this copy
            </button>
          </p>
        )}

        <ImportCard
          hasContent={hasContent}
          onImported={(content, termNames) => {
            setPicked((n) => ({ ...n, ...termNames }))
            const cur = getValues()
            // Keep what a resume cannot settle: contact, leadership and job preferences.
            reset(
              {
                ...toForm(content, cur.contact),
                leadershipLevel: cur.leadershipLevel,
                locationsText: cur.locationsText,
                workModes: cur.workModes,
                minSalary: cur.minSalary,
              },
              { keepDefaultValues: true },
            )
          }}
        />

        <PhotoCard name={accountName} />

        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
            <CardDescription>
              Only employers you apply to can see these, and they always see your latest details. They are
              not part of your resume versions and do not affect your match score.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 0100"
                aria-invalid={!!errors.contact?.phone}
                {...register('contact.phone')}
              />
              <FieldError message={errors.contact?.phone?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-email">Contact email</Label>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                placeholder={accountEmail || 'Defaults to your account email'}
                aria-invalid={!!errors.contact?.email}
                {...register('contact.email')}
              />
              <p className="text-xs text-muted-foreground">Leave empty to use your account email.</p>
              <FieldError message={errors.contact?.email?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-city">City</Label>
              <Input
                id="contact-city"
                autoComplete="address-level2"
                aria-invalid={!!errors.contact?.city}
                {...register('contact.city')}
              />
              <FieldError message={errors.contact?.city?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-country">Country</Label>
              <Input
                id="contact-country"
                autoComplete="country-name"
                aria-invalid={!!errors.contact?.country}
                {...register('contact.country')}
              />
              <FieldError message={errors.contact?.country?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-linkedin">LinkedIn</Label>
              <Input
                id="contact-linkedin"
                type="url"
                placeholder="https://www.linkedin.com/in/..."
                aria-invalid={!!errors.contact?.linkedin}
                {...register('contact.linkedin')}
              />
              <FieldError message={errors.contact?.linkedin?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-github">GitHub</Label>
              <Input
                id="contact-github"
                type="url"
                placeholder="https://github.com/..."
                aria-invalid={!!errors.contact?.github}
                {...register('contact.github')}
              />
              <FieldError message={errors.contact?.github?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-website">Website or portfolio</Label>
              <Input
                id="contact-website"
                type="url"
                placeholder="https://"
                aria-invalid={!!errors.contact?.website}
                {...register('contact.website')}
              />
              <FieldError message={errors.contact?.website?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-other">Other link</Label>
              <Input
                id="contact-other"
                type="url"
                placeholder="https://"
                aria-invalid={!!errors.contact?.other}
                {...register('contact.other')}
              />
              <FieldError message={errors.contact?.other?.message} />
            </div>
          </CardContent>
        </Card>

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
              the description are shown to employers but are not scored. Entries appear on your resume in
              this order: use the arrows to rearrange them.
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
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move role up"
                      disabled={i === 0}
                      onClick={() => roles.move(i, i - 1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move role down"
                      disabled={i === roles.fields.length - 1}
                      onClick={() => roles.move(i, i + 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
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
              and dates are shown to employers. Use the arrows to set the order they appear in.
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
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move education up"
                      disabled={i === 0}
                      onClick={() => education.move(i, i - 1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move education down"
                      disabled={i === education.fields.length - 1}
                      onClick={() => education.move(i, i + 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
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

      <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <EvaluationCard hasUnsavedChanges={isDirty} />
        <VersionHistory
          onRestore={onRestore}
          restoring={restore.isPending}
          hasUnsavedChanges={isDirty}
        />
      </aside>
    </main>
  )
}
