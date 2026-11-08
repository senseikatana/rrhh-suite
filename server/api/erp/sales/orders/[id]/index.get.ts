import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'

/**
 * Detalle de un pedido de venta con sus líneas.
 * El scope por organización es lo que impide leer pedidos de otro tenant.
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)
  const orderId = getRouterParam(event, 'id')

  const [order] = await db
    .select()
    .from(schema.erpSalesOrders)
    .where(eq(schema.erpSalesOrders.id, orderId!))

  if (!order || order.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Sales order not found' })
  }

  const lines = await db
    .select()
    .from(schema.erpSalesOrderLines)
    .where(eq(schema.erpSalesOrderLines.orderId, order.id))

  return { ...order, lines }
})
