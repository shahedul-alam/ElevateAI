import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { NativeSelect } from '@/components/native-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { searchCatalog } from '@/features/catalog/catalog.api'
import { CompanyLogo } from '@/features/company/company-logo'
import { VerifiedBadge } from '@/features/company/company-profile-view'
import type { CompanyFilters } from '@/features/company/company.api'
import { useCompanies } from '@/features/company/use-company'

export default function Companies() {
  const [filters, setFilters] = useState<CompanyFilters>({ q: '', domainId: '' })
  const [search, setSearch] = useState('')
  const companies = useCompanies(filters)

  const domains = useQuery({
    queryKey: ['catalog', 'domain', 'all'],
    queryFn: () => searchCatalog('domain', '', 50),
    staleTime: 5 * 60_000,
  })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setFilters((f) => ({ ...f, q: search.trim() }))
  }

  const pages = companies.data?.pages ?? []
  const cards = pages.flatMap((p) => p.companies)
  const names = Object.assign({}, ...pages.map((p) => p.termNames)) as Record<string, string>

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Companies</h1>
      <p className="mb-6 text-sm text-muted-foreground">Get to know the teams behind the jobs.</p>

      <form onSubmit={onSearch} className="mb-6 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
        <Input
          aria-label="Search companies"
          placeholder="Search by company name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <NativeSelect
          aria-label="Industry"
          value={filters.domainId}
          onChange={(e) => setFilters((f) => ({ ...f, domainId: e.target.value }))}
        >
          <option value="">Any industry</option>
          {(domains.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Search</Button>
      </form>

      {companies.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : companies.isError ? (
        <p className="text-sm text-destructive">Could not load companies. Try again in a moment.</p>
      ) : cards.length === 0 ? (
        <p className="text-muted-foreground">No companies match your search.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => {
            const meta = [c.headquarters, c.domainId && names[c.domainId]].filter(Boolean)
            return (
              <li key={c.id}>
                <Link to={`/companies/${c.id}`} className="block h-full rounded-xl focus-visible:outline-2">
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardContent className="flex gap-3">
                      <CompanyLogo id={c.id} name={c.name} logoUrl={c.logoUrl} className="size-12" />
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{c.name}</p>
                          {c.verified && <VerifiedBadge />}
                        </div>
                        {c.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{c.tagline}</p>}
                        <p className="text-xs text-muted-foreground">
                          {[...meta, `${c.openPositions} open ${c.openPositions === 1 ? 'role' : 'roles'}`].join(' · ')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {companies.hasNextPage && (
        <div className="mt-6 text-center">
          <Button variant="outline" disabled={companies.isFetchingNextPage} onClick={() => companies.fetchNextPage()}>
            {companies.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </main>
  )
}
