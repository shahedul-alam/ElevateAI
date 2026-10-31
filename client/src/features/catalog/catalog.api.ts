import { api } from '@/lib/api'

export type CatalogKind = 'skill' | 'certification' | 'domain'
export type CatalogTerm = { id: string; name: string }

export async function searchCatalog(kind: CatalogKind, q: string, limit = 20) {
  const { data } = await api.get<{ terms: CatalogTerm[] }>('/catalog', { params: { kind, q, limit } })
  return data.terms
}
