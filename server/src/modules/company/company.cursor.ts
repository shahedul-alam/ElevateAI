import { z } from 'zod'
import type { Prisma } from '../../../generated/prisma/client'

/**
 * The directory is ordered by (verified desc, name asc, id asc). A cursor that remembers only the
 * last row's id breaks when that ordering changes between page requests (an admin verifies a
 * company): rows get skipped or repeated. This cursor remembers the sort position itself, so the next
 * page always continues from the same point in the ordering.
 */
const positionSchema = z.object({ v: z.boolean(), n: z.string().max(200), i: z.uuid() })
export type CursorPosition = z.infer<typeof positionSchema>

export const encodeCursor = (row: { verified: boolean; name: string; id: string }) =>
  Buffer.from(JSON.stringify({ v: row.verified, n: row.name, i: row.id })).toString('base64url')

/** Returns null for anything that is not a cursor this server issued. */
export function decodeCursor(value: string): CursorPosition | null {
  try {
    const parsed = positionSchema.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export const DIRECTORY_ORDER: Prisma.CompanyOrderByWithRelationInput[] = [
  { verified: 'desc' },
  { name: 'asc' },
  { id: 'asc' },
]

/** The rows strictly after `position` in DIRECTORY_ORDER. */
export const afterPosition = (position: CursorPosition): Prisma.CompanyWhereInput => ({
  OR: [
    // verified sorts first, so after a verified row come all unverified rows.
    ...(position.v ? [{ verified: false }] : []),
    { verified: position.v, name: { gt: position.n } },
    { verified: position.v, name: position.n, id: { gt: position.i } },
  ],
})
