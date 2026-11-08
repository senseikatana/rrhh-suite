import { and, desc, eq, sql } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'

/**
 * Log de actividad más reciente, de más nuevo a más antiguo.
 * Fuente de la auditoría y de los KPIs del dashboard.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 200)

  const where = eq(schema.erpActivityEvents.orgId, orgId)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.erpActivityEvents)
    .where(where)

  const items = await db
    .select()
    .from(schema.erpActivityEvents)
    .where(where)
    .orderBy(desc(schema.erpActivityEvents.occurredAt), desc(schema.erpActivityEvents.id))
    .limit(limit)

  return { items, meta: { total: countRow?.total ?? 0, limit, offset: 0 } }
})
