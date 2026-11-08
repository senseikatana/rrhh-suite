import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'

/**
 * Listado de clientes con búsqueda opcional por nombre o código.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 500)
  const offset = Math.max(Number(query.offset ?? 0), 0)
  const search = (query.search as string | undefined)?.trim()

  const conditions: SQL[] = [eq(schema.erpCustomers.orgId, orgId)]
  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(sql`${schema.erpCustomers.name} ilike ${pattern}`, sql`${schema.erpCustomers.code} ilike ${pattern}`)!,
    )
  }
  const where = and(...conditions)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.erpCustomers)
    .where(where)

  const items = await db
    .select()
    .from(schema.erpCustomers)
    .where(where)
    .orderBy(asc(schema.erpCustomers.name))
    .limit(limit)
    .offset(offset)

  return { items, meta: { total: countRow?.total ?? 0, limit, offset } }
})
