import { and, eq } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'
import { recordActivity } from '../../../services/erp-activity'
import { parseOrThrow, vendorCreate } from '../../../utils/erp-schemas'

/**
 * Alta de proveedor. Solo admin y compras (los datos maestros de
 * proveedores pertenecen a compras).
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (!['admin', 'buyer'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, buyer`,
    })
  }

  const body = parseOrThrow(vendorCreate, await readBody(event), 'Invalid vendor')

  const [existing] = await db
    .select()
    .from(schema.erpVendors)
    .where(and(eq(schema.erpVendors.orgId, orgId), eq(schema.erpVendors.code, body.code)))
    .limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Vendor code '${body.code}' already exists` })
  }

  const vendor = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.erpVendors)
      .values({
        id: crypto.randomUUID(),
        orgId,
        code: body.code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        leadTimeDays: body.leadTimeDays,
        qualityRating: body.qualityRating,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await recordActivity(tx, {
      orgId,
      actorId: actor.id,
      actorUsername: actor.username,
      entity: 'vendor',
      action: 'created',
      entityId: created!.id,
      summary: `Created vendor ${created!.code}`,
    })

    return created!
  })

  setResponseStatus(event, 201)
  return vendor
})
