import { and, eq, sql } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'
import { recordActivity } from '../../../../../services/erp-activity'

/**
 * Corrección manual de stock.
 * Cada ajuste se registra con el motivo, así una discrepancia siempre se puede
 * rastrear hasta una persona y una justificación.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (actor.role !== 'admin' && actor.role !== 'logistics') {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, logistics`,
    })
  }

  const itemId = getRouterParam(event, 'id')
  const body = await readBody(event)

  const quantity = Number(body?.quantity)
  if (!Number.isFinite(quantity) || quantity === 0) {
    throw createError({ statusCode: 400, statusMessage: 'quantity is required and must be non-zero' })
  }

  const [item] = await db.select().from(schema.erpItems).where(eq(schema.erpItems.id, itemId!))
  if (!item || item.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Item not found' })
  }

  // Update atómico con la validación del negativo en SQL: dos ajustes
  // concurrentes no se pisan (read-then-write perdería uno).
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.erpItems)
      .set({
        stock: sql`${schema.erpItems.stock} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.erpItems.id, item.id),
          sql`${schema.erpItems.stock} + ${quantity} >= 0`,
        ),
      )
      .returning()

    if (!row) {
      throw createError({
        statusCode: 400,
        statusMessage: `Adjustment would drive stock negative`,
      })
    }

    await recordActivity(tx, {
      orgId,
      actorId: actor.id,
      actorUsername: actor.username,
      entity: 'item',
      action: 'stock_adjusted',
      entityId: item.id,
      summary: `Adjusted ${item.code} by ${quantity}`,
      payload: {
        previous: String(item.stock),
        new: String(row.stock),
        delta: String(quantity),
        reason: body?.reason ?? null,
      },
    })

    return row
  })

  return result
})
