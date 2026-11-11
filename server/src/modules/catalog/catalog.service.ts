import { prisma } from '../../config/db'
import { HttpError } from '../../middleware/errors'
import type { CatalogKind } from '../../../generated/prisma/client'
import { normalizeAlias } from './catalog.normalize'
import { CERTIFICATIONS, DOMAINS, SKILLS, type SeedTerm } from './catalog.seed-data'

const SEEDS: Record<CatalogKind, SeedTerm[]> = {
  skill: SKILLS,
  certification: CERTIFICATIONS,
  domain: DOMAINS,
}

/** Autocomplete: approved terms whose name or any alias contains the query. Empty query lists A-Z. */
export async function searchCatalog(kind: CatalogKind, q: string, limit: number) {
  const key = normalizeAlias(q)
  return prisma.catalogTerm.findMany({
    where: {
      kind,
      status: 'approved',
      ...(key
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { aliases: { some: { alias: { contains: key } } } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: limit,
  })
}

/** normalized alias -> approved term id, for the given free-text names of one kind. */
export async function lookupAliases(kind: CatalogKind, names: string[]) {
  const keys = [...new Set(names.map(normalizeAlias).filter(Boolean))]
  const lookup = new Map<string, string>()
  if (keys.length === 0) return lookup
  const rows = await prisma.catalogAlias.findMany({
    where: { kind, alias: { in: keys }, term: { status: 'approved' } },
    select: { alias: true, termId: true },
  })
  for (const r of rows) lookup.set(r.alias, r.termId)
  return lookup
}

/** id -> display name for the given catalog ids (any status). */
export async function termNamesFor(ids: Iterable<string>) {
  const rows = await prisma.catalogTerm.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true },
  })
  return Object.fromEntries(rows.map((t) => [t.id, t.name]))
}

/**
 * Every id stored in a profile or job must be an approved catalog term, otherwise the engine
 * would silently score it as zero. `wanted` maps id -> the field path to report.
 */
export async function assertApprovedTerms(wanted: Map<string, string>) {
  if (wanted.size === 0) return
  const found = await prisma.catalogTerm.findMany({
    where: { id: { in: [...wanted.keys()] }, status: 'approved' },
    select: { id: true },
  })
  const ok = new Set(found.map((t) => t.id))
  const details = [...wanted]
    .filter(([id]) => !ok.has(id))
    .map(([, field]) => ({ field, message: 'Unknown catalog term' }))
  if (details.length > 0) throw new HttpError(400, 'Invalid request', details)
}

// Idempotent: terms upsert on `kind:slug`; each term's alias keys (its own name, slug and
// listed aliases) are added if missing. Existing ids never change.
export async function seedCatalog() {
  let terms = 0
  for (const kind of Object.keys(SEEDS) as CatalogKind[]) {
    for (const t of SEEDS[kind]) {
      const id = `${kind}:${t.slug}`
      await prisma.catalogTerm.upsert({
        where: { id },
        update: { name: t.name },
        create: { id, kind, slug: t.slug, name: t.name },
      })
      const keys = new Set(
        [t.name, t.slug, ...(t.aliases ?? [])].map(normalizeAlias).filter((k) => k.length > 0),
      )
      for (const alias of keys) {
        await prisma.catalogAlias.upsert({
          where: { kind_alias: { kind, alias } },
          update: {},
          create: { termId: id, kind, alias },
        })
      }
      terms++
    }
  }
  return { terms }
}
