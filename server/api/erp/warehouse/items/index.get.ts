import { and, asc, eq, lt, or, sql, type SQL } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'

/**
 * Listado de artículos de inventario con filtros opcionales:
 * búsqueda por código/descripción, por debajo del mínimo, ubicación.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 500)
  const offset = Math.max(Number(query.offset ?? 0), 0)
  const search = (query.search as string | undefined)?.trim()
  const belowMinimum = query.below_minimum === 'true' || query.below_minimum === true
  const location = (query.location as string | undefined)?.trim()

  const conditions: SQL[] = [eq(schema.erpItems.orgId, orgId)]
  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        sql`${schema.erpItems.code} ilike ${pattern}`,
        sql`${schema.erpItems.description} ilike ${pattern}`,
      )!,
    )
  }
  if (belowMinimum) {
    conditions.push(lt(schema.erpItems.stock, schema.erpItems.minStock))
  }
  if (location) {
    conditions.push(eq(schema.erpItems.location, location))
  }
  const where = and(...conditions)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.erpItems)
    .where(where)

  const items = await db
    .select()
    .from(schema.erpItems)
    .where(where)
    .orderBy(asc(schema.erpItems.code))
    .limit(limit)
    .offset(offset)

  return {
    items,
    meta: { total: countRow?.total ?? 0, limit, offset },
  }
})
