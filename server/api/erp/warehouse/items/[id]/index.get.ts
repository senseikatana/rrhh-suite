import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'

/** Detalle de un artículo de inventario. */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)
  const itemId = getRouterParam(event, 'id')

  const [item] = await db.select().from(schema.erpItems).where(eq(schema.erpItems.id, itemId!))
  if (!item || item.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Item not found' })
  }
  return item
})
