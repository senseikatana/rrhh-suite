import { and, eq } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'
import { recordActivity } from '../../../../services/erp-activity'
import { itemCreate, parseOrThrow } from '../../../../utils/erp-schemas'

/** Alta de un artículo. Solo logística y administración. */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (actor.role !== 'admin' && actor.role !== 'logistics') {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, logistics`,
    })
  }

  const body = parseOrThrow(itemCreate, await readBody(event), 'Invalid item')

  const [existing] = await db
    .select()
    .from(schema.erpItems)
    .where(and(eq(schema.erpItems.orgId, orgId), eq(schema.erpItems.code, body.code)))
    .limit(1)

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Item code '${body.code}' already exists` })
  }

  const item = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.erpItems)
      .values({
        id: crypto.randomUUID(),
        orgId,
        code: body.code,
        description: body.description,
        unit: body.unit,
        unitCost: Number(body.unitCost).toFixed(2),
        unitPrice: Number(body.unitPrice).toFixed(2),
        stock: Number(body.stock).toFixed(3),
        minStock: Number(body.minStock).toFixed(3),
        location: body.location,
        category: body.category ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await recordActivity(tx, {
      orgId,
      actorId: actor.id,
      actorUsername: actor.username,
      entity: 'item',
      action: 'created',
      entityId: created!.id,
      summary: `Created item ${created!.code}`,
      payload: { code: created!.code, description: created!.description },
    })

    return created!
  })

  setResponseStatus(event, 201)
  return item
})
