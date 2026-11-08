import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'

/**
 * Listado de la hoja de demanda, con filtro opcional por acción.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 100), 1), 500)
  const offset = Math.max(Number(query.offset ?? 0), 0)

  // Validar el filtro contra los valores del enum: un valor fuera de él llega a
  // `inArray` y Postgres revienta con un 500 en vez de un 400 claro.
  const actionValues = schema.erpDemandLines.action.enumValues as readonly string[]
  const rawAction = query.action ? ([] as string[]).concat(query.action as string[]) : []
  for (const a of rawAction) {
    if (!actionValues.includes(a)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid action filter: '${a}'` })
    }
  }
  const actionFilter = rawAction as (typeof schema.erpDemandLines.action.enumValues)[number][]

  const conditions: SQL[] = [eq(schema.erpDemandLines.orgId, orgId)]
  if (actionFilter.length) {
    conditions.push(inArray(schema.erpDemandLines.action, actionFilter))
  }
  const where = and(...conditions)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.erpDemandLines)
    .where(where)

  const items = await db
    .select({
      id: schema.erpDemandLines.id,
      orgId: schema.erpDemandLines.orgId,
      itemId: schema.erpDemandLines.itemId,
      requiredDate: schema.erpDemandLines.requiredDate,
      quantityNeeded: schema.erpDemandLines.quantityNeeded,
      source: schema.erpDemandLines.source,
      action: schema.erpDemandLines.action,
      createdAt: schema.erpDemandLines.createdAt,
      updatedAt: schema.erpDemandLines.updatedAt,
      itemCode: schema.erpItems.code,
      itemDescription: schema.erpItems.description,
    })
    .from(schema.erpDemandLines)
    .leftJoin(schema.erpItems, eq(schema.erpDemandLines.itemId, schema.erpItems.id))
    .where(where)
    .orderBy(asc(schema.erpDemandLines.requiredDate))
    .limit(limit)
    .offset(offset)

  return { items, meta: { total: countRow?.total ?? 0, limit, offset } }
})
