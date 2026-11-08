import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'

/**
 * Listado de rutas de transporte, ordenado por fecha descendente.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 500)
  const offset = Math.max(Number(query.offset ?? 0), 0)
  const dateFilter = (query.date as string | undefined)?.trim()

  const conditions: SQL[] = [eq(schema.erpRoutes.orgId, orgId)]
  if (dateFilter) {
    conditions.push(eq(schema.erpRoutes.date, dateFilter))
  }
  const where = and(...conditions)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.erpRoutes)
    .where(where)

  const items = await db
    .select()
    .from(schema.erpRoutes)
    .where(where)
    .orderBy(desc(schema.erpRoutes.date), asc(schema.erpRoutes.code))
    .limit(limit)
    .offset(offset)

  return { items, meta: { total: countRow?.total ?? 0, limit, offset } }
})
