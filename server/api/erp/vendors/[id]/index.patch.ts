import { eq } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'

/**
 * Actualización de datos maestros de un proveedor. Solo admin y compras.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (!['admin', 'buyer'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, buyer`,
    })
  }

  const vendorId = getRouterParam(event, 'id')
  const body = await readBody(event)

  const [vendor] = await db.select().from(schema.erpVendors).where(eq(schema.erpVendors.id, vendorId!))
  if (!vendor || vendor.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor not found' })
  }

  const allowed = ['code', 'name', 'email', 'phone', 'leadTimeDays', 'qualityRating'] as const
  const patch: Record<string, unknown> = {}
  for (const field of allowed) {
    if (body && field in body) patch[field] = body[field]
  }

  const [updated] = await db
    .update(schema.erpVendors)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.erpVendors.id, vendor.id))
    .returning()

  return updated
})
