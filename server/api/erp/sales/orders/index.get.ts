import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'

/**
 * Listado de pedidos de venta, con filtro opcional por estado.
 * Paginación limit/offset igual que el contrato original.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 500)
  const offset = Math.max(Number(query.offset ?? 0), 0)

  // Validar el filtro contra los valores del enum: un valor fuera de él llega a
  // `inArray` y Postgres revienta con un 500 en vez de un 400 claro.
  const statusValues = schema.erpSalesOrders.status.enumValues as readonly string[]
  const rawStatus = query.status ? ([] as string[]).concat(query.status as string[]) : []
  for (const s of rawStatus) {
    if (!statusValues.includes(s)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid status filter: '${s}'` })
    }
  }
  const statusFilter = rawStatus as (typeof schema.erpSalesOrders.status.enumValues)[number][]

  const conditions: SQL[] = [eq(schema.erpSalesOrders.orgId, orgId)]
  if (statusFilter.length) {
    conditions.push(inArray(schema.erpSalesOrders.status, statusFilter))
  }
  const where = and(...conditions)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.erpSalesOrders)
    .where(where)

  const items = await db
    .select()
    .from(schema.erpSalesOrders)
    .where(where)
    .orderBy(desc(schema.erpSalesOrders.orderDate), desc(schema.erpSalesOrders.id))
    .limit(limit)
    .offset(offset)

  return {
    items,
    meta: { total: countRow?.total ?? 0, limit, offset },
  }
})
