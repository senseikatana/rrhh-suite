import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'
import { recordActivity } from '../../../../../services/erp-activity'

/**
 * Actualización de datos maestros de un artículo. Solo logística y admin.
 * El stock NO se edita aquí: se mueve por recepciones, aprobaciones de Calidad
 * y ajustes explícitos, para que cada cambio tenga un motivo y un autor.
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

  const [item] = await db.select().from(schema.erpItems).where(eq(schema.erpItems.id, itemId!))
  if (!item || item.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Item not found' })
  }

  // Campos editables (stock excluido a propósito).
  const allowed = ['code', 'description', 'unit', 'unitCost', 'unitPrice', 'minStock', 'location', 'category'] as const
  const patch: Record<string, unknown> = {}
  for (const field of allowed) {
    if (body && field in body) patch[field] = body[field]
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.erpItems)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.erpItems.id, item.id))
      .returning()

    await recordActivity(tx, {
      orgId,
      actorId: actor.id,
      actorUsername: actor.username,
      entity: 'item',
      action: 'updated',
      entityId: item.id,
      summary: `Updated item ${row!.code}`,
    })

    return row!
  })

  return updated
})
