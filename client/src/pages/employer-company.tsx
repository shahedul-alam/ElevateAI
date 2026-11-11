import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, type ChangeEvent } from 'react'
import { useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { FieldError } from '@/components/field-error'
import { ListCard, ListRow } from '@/components/list-card'
import { NativeSelect } from '@/components/native-select'
import { RequireRole } from '@/components/require-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchCatalog } from '@/features/catalog/catalog.api'
import { CompanyCover, CompanyLogo } from '@/features/company/company-logo'
import { CompanyProfileView } from '@/features/company/company-profile-view'
import {
  COMPANY_SIZES,
  FUNDING_STAGES,
  IMAGE_ACCEPT,
  IMAGE_LIMITS,
  WORK_POLICIES,
  WORK_POLICY_LABELS,
  companyFormSchema,
  emptyCompanyForm,
  previewCompany,
  toCompanyForm,
  toCompanyPayload,
  type CompanyFormValues,
} from '@/features/company/company.schema'
import {
  useCompany,
  useMyCompany,
  useRemoveCompanyImage,
  useSaveCompany,
  useUploadCompanyImage,
} from '@/features/company/use-company'
import { getApiError } from '@/lib/api'

export default function EmployerCompany() {
  return (
    <RequireRole role="employer" message="Company profiles are managed by employer accounts.">
      <CompanyFormPage />
    </RequireRole>
  )
}

const textareaClass =
  'min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30'

type RowListName = 'benefits' | 'hubs'

function RowListCard({
  name,
  title,
  description,
  placeholder,
  control,
  register,
  errors,
}: {
  name: RowListName
  title: string
  description: string
  placeholder: string
  control: Control<CompanyFormValues>
  register: UseFormRegister<CompanyFormValues>
  errors: FieldErrors<CompanyFormValues>
}) {
  const rows = useFieldArray({ control, name })
  return (
    <ListCard
      title={title}
      description={description}
      count={rows.fields.length}
      max={20}
      error={errors[name]?.root?.message ?? errors[name]?.message}
      onAdd={() => rows.append({ value: '' })}
    >
      {rows.fields.map((row, i) => (
        <ListRow key={row.id} label={`${title} ${i + 1}`} onRemove={() => rows.remove(i)}>
          <Input
            aria-label={`${title} ${i + 1}`}
            placeholder={placeholder}
            aria-invalid={!!errors[name]?.[i]?.value}
            {...register(`${name}.${i}.value`)}
          />
        </ListRow>
      ))}
    </ListCard>
  )
}

function ImageField({
  kind,
  label,
  hint,
  url,
  onPick,
  onRemove,
  busy,
  children,
}: {
  kind: 'logo' | 'cover'
  label: string
  hint: string
  url: string | null
  onPick: (file: File) => void
  onRemove: () => void
  busy: boolean
  children: React.ReactNode
}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
      toast.error('Unsupported file', { description: 'Use a PNG, JPEG or WebP image.' })
      return
    }
    if (file.size > IMAGE_LIMITS[kind]) {
      toast.error('File too large', { description: `The ${kind} must be under ${IMAGE_LIMITS[kind] / 1024} KB.` })
      return
    }
    onPick(file)
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${kind}-file`}>{label}</Label>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
          <label htmlFor={`${kind}-file`} className="cursor-pointer">
            {url ? 'Replace' : 'Upload'}
          </label>
        </Button>
        <input
          id={`${kind}-file`}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          onChange={onChange}
          disabled={busy}
        />
        {url && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
            Remove
          </Button>
        )}
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  )
}

function CompanyFormPage() {
  const mine = useMyCompany()
  const save = useSaveCompany()
  const upload = useUploadCompanyImage()
  const remove = useRemoveCompanyImage()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'preview' ? 'preview' : 'edit'
  const setTab = (next: 'edit' | 'preview') =>
    setSearchParams(next === 'preview' ? { tab: 'preview' } : {}, { replace: true })

  const domains = useQuery({
    queryKey: ['catalog', 'domain', 'all'],
    queryFn: () => searchCatalog('domain', '', 50),
    staleTime: 5 * 60_000,
  })
  const published = useCompany(mine.data?.id ?? '')

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<CompanyFormValues>({ resolver: zodResolver(companyFormSchema), defaultValues: emptyCompanyForm })
  const culture = useFieldArray({ control, name: 'culture' })
  const awards = useFieldArray({ control, name: 'awards' })
  const watched = useWatch({ control }) as CompanyFormValues

  // Load once. Image uploads refetch the company; resetting then would wipe unsaved text edits.
  const loaded = useRef(false)
  useEffect(() => {
    if (mine.data && !loaded.current) {
      loaded.current = true
      reset(toCompanyForm(mine.data))
    }
  }, [mine.data, reset])

  const onSubmit = (values: CompanyFormValues) => {
    save.mutate(toCompanyPayload(values), {
      onSuccess: () => {
        reset(values)
        toast.success('Company profile saved')
      },
      onError: (err) => toast.error('Could not save', { description: getApiError(err).message }),
    })
  }

  const imageMutation = (kind: 'logo' | 'cover') => ({
    onPick: (file: File) =>
      upload.mutate(
        { kind, file },
        {
          onSuccess: () => toast.success(`${kind === 'logo' ? 'Logo' : 'Cover'} updated`),
          onError: (err) => toast.error('Upload failed', { description: getApiError(err).message }),
        },
      ),
    onRemove: () =>
      remove.mutate(kind, {
        onSuccess: () => toast.success(`${kind === 'logo' ? 'Logo' : 'Cover'} removed`),
        onError: (err) => toast.error('Could not remove', { description: getApiError(err).message }),
      }),
  })

  if (mine.isPending) return null
  if (mine.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-destructive">Could not load your company profile. Try again in a moment.</p>
      </main>
    )
  }

  const company = mine.data
  const busy = upload.isPending || remove.isPending
  const preview = previewCompany({ ...emptyCompanyForm, ...watched }, company)
  const previewNames = Object.fromEntries((domains.data ?? []).map((d) => [d.id, d.name]))

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company profile</h1>
          <p className="text-sm text-muted-foreground">
            Candidates see this page from every job you post.{' '}
            <Link to={`/companies/${company.id}`} className="underline">
              View public page
            </Link>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {company.verified
              ? 'Your company is verified. Changing the company name, website or social links removes the badge until ElevateAI reviews it again.'
              : 'The Verified Employer badge is granted by ElevateAI after a review.'}
          </p>
        </div>

        <div role="tablist" aria-label="Company profile" className="flex gap-1 border-b">
          {(['edit', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`company-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`company-panel-${t}`}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'preview' && (
          <div role="tabpanel" id="company-panel-preview" aria-labelledby="company-tab-preview" className="flex flex-col gap-4">
            <p role="status" className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              This is how candidates will see your page{isDirty ? ', including your unsaved changes.' : '.'}
            </p>
            <CompanyProfileView
              company={preview}
              jobs={published.data?.jobs ?? []}
              termNames={previewNames}
            />
          </div>
        )}

        <div
          hidden={tab !== 'edit'}
          id="company-panel-edit"
          role="tabpanel"
          aria-labelledby="company-tab-edit"
          className="flex flex-col gap-6 [&[hidden]]:hidden"
        >
          <Card>
            <CardHeader>
              <CardTitle>Logo &amp; cover</CardTitle>
              <CardDescription>
                PNG, JPEG or WebP. Images save right away; the rest of the profile saves with the button below.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <ImageField
                kind="cover"
                label="Cover image"
                hint="Wide image, up to 2 MB"
                url={company.coverUrl}
                busy={busy}
                {...imageMutation('cover')}
              >
                <CompanyCover id={company.id} name={company.name} coverUrl={company.coverUrl} className="h-32 rounded-lg" />
              </ImageField>
              <ImageField
                kind="logo"
                label="Logo"
                hint="Square image, up to 512 KB"
                url={company.logoUrl}
                busy={busy}
                {...imageMutation('logo')}
              >
                <CompanyLogo id={company.id} name={company.name} logoUrl={company.logoUrl} className="size-20 text-2xl" />
              </ImageField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Company name</Label>
                <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" placeholder="One line about what you do" {...register('tagline')} />
                <FieldError message={errors.tagline?.message} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="headquarters">Headquarters</Label>
                  <Input id="headquarters" placeholder="San Francisco, CA" {...register('headquarters')} />
                  <FieldError message={errors.headquarters?.message} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="foundedYear">Founded (year)</Label>
                  <Input id="foundedYear" inputMode="numeric" placeholder="2021" {...register('foundedYear')} />
                  <FieldError message={errors.foundedYear?.message} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="size">Company size</Label>
                  <NativeSelect id="size" {...register('size')}>
                    <option value="">Not specified</option>
                    {COMPANY_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s} employees
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fundingStage">Funding stage</Label>
                  <NativeSelect id="fundingStage" {...register('fundingStage')}>
                    <option value="">Not specified</option>
                    {FUNDING_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="domainId">Industry</Label>
                  <NativeSelect id="domainId" {...register('domainId')}>
                    <option value="">Not specified</option>
                    {(domains.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="workPolicy">Work policy</Label>
                  <NativeSelect id="workPolicy" {...register('workPolicy')}>
                    <option value="">Not specified</option>
                    {WORK_POLICIES.map((p) => (
                      <option key={p} value={p}>
                        {WORK_POLICY_LABELS[p]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About &amp; mission</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="about">About the company</Label>
                <textarea id="about" className={textareaClass} aria-invalid={!!errors.about} {...register('about')} />
                <FieldError message={errors.about?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mission">Core mission</Label>
                <textarea
                  id="mission"
                  className={textareaClass}
                  aria-invalid={!!errors.mission}
                  {...register('mission')}
                />
                <FieldError message={errors.mission?.message} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
              <CardDescription>Full links starting with https://</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['website', 'Website'],
                  ['linkedin', 'LinkedIn'],
                  ['github', 'GitHub'],
                  ['x', 'X / Twitter'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="flex flex-col gap-2">
                  <Label htmlFor={field}>{label}</Label>
                  <Input id={field} inputMode="url" aria-invalid={!!errors[field]} {...register(field)} />
                  <FieldError message={errors[field]?.message} />
                </div>
              ))}
            </CardContent>
          </Card>

          <ListCard
            title="Culture & principles"
            description="Up to 8 values that describe how your team works."
            count={culture.fields.length}
            max={8}
            error={errors.culture?.root?.message ?? errors.culture?.message}
            onAdd={() => culture.append({ title: '', description: '' })}
          >
            {culture.fields.map((row, i) => (
              <ListRow key={row.id} label={`principle ${i + 1}`} onRemove={() => culture.remove(i)}>
                <div className="flex flex-1 flex-col gap-1">
                  <Input
                    aria-label={`Principle ${i + 1} title`}
                    placeholder="Radical ownership"
                    aria-invalid={!!errors.culture?.[i]?.title}
                    {...register(`culture.${i}.title`)}
                  />
                  <FieldError message={errors.culture?.[i]?.title?.message} />
                </div>
                <div className="flex flex-[2] flex-col gap-1">
                  <Input
                    aria-label={`Principle ${i + 1} description`}
                    placeholder="What it looks like day to day"
                    aria-invalid={!!errors.culture?.[i]?.description}
                    {...register(`culture.${i}.description`)}
                  />
                  <FieldError message={errors.culture?.[i]?.description?.message} />
                </div>
              </ListRow>
            ))}
          </ListCard>

          <ListCard
            title="Awards & recognition"
            description="Press, rankings and industry awards."
            count={awards.fields.length}
            max={15}
            error={errors.awards?.root?.message ?? errors.awards?.message}
            onAdd={() => awards.append({ title: '', issuer: '', year: '' })}
          >
            {awards.fields.map((row, i) => (
              <ListRow key={row.id} label={`award ${i + 1}`} onRemove={() => awards.remove(i)}>
                <div className="flex flex-[2] flex-col gap-1">
                  <Input
                    aria-label={`Award ${i + 1} title`}
                    placeholder="Best Places to Work"
                    aria-invalid={!!errors.awards?.[i]?.title}
                    {...register(`awards.${i}.title`)}
                  />
                  <FieldError message={errors.awards?.[i]?.title?.message} />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Input
                    aria-label={`Award ${i + 1} issuer`}
                    placeholder="Issuer (optional)"
                    {...register(`awards.${i}.issuer`)}
                  />
                  <FieldError message={errors.awards?.[i]?.issuer?.message} />
                </div>
                <div className="flex w-full flex-col gap-1 sm:w-24">
                  <Input
                    aria-label={`Award ${i + 1} year`}
                    inputMode="numeric"
                    placeholder="Year"
                    aria-invalid={!!errors.awards?.[i]?.year}
                    {...register(`awards.${i}.year`)}
                  />
                  <FieldError message={errors.awards?.[i]?.year?.message} />
                </div>
              </ListRow>
            ))}
          </ListCard>

          <RowListCard
            name="benefits"
            title="Candidate benefits & perks"
            description="What working here includes."
            placeholder="e.g. 100% employer-covered health insurance"
            control={control}
            register={register}
            errors={errors}
          />
          <RowListCard
            name="hubs"
            title="Global hubs & remote policy"
            description="Offices and the places you hire from."
            placeholder="e.g. London, UK (Remote)"
            control={control}
            register={register}
            errors={errors}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save changes'}
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
