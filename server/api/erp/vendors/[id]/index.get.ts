import { eq } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'

/** Detalle de un proveedor. */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)
  const vendorId = getRouterParam(event, 'id')

  const [vendor] = await db.select().from(schema.erpVendors).where(eq(schema.erpVendors.id, vendorId!))
  if (!vendor || vendor.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor not found' })
  }
  return vendor
})
