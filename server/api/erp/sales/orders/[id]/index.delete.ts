import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'
import {
  changeStatus,
  getOrderLines,
  TransitionError,
} from '../../../../../services/erp-sales'

/**
 * Cancela un pedido que no haya sido facturado.
 * Un pedido INVOICED o CANCELLED no se puede cancelar (409).
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)
  const orderId = getRouterParam(event, 'id')

  try {
    await db.transaction(async (tx) => {
      // Orden y líneas se leen DENTRO de la transacción para evitar TOCTOU.
      const [order] = await tx
        .select()
        .from(schema.erpSalesOrders)
        .where(eq(schema.erpSalesOrders.id, orderId!))

      if (!order || order.orgId !== orgId) {
        throw new TransitionError('Sales order not found')
      }

      if (order.status === 'INVOICED' || order.status === 'CANCELLED') {
        throw new TransitionError(
          `An order in status ${order.status} cannot be cancelled`,
        )
      }

      const lines = await getOrderLines(tx, order.id)
      await changeStatus(tx, orgId, actor, order, lines, {
        status: 'CANCELLED',
        reason: null,
      })
    })
    return { message: 'Order cancelled' }
  } catch (err) {
    if (err instanceof TransitionError) {
      const status = err.message === 'Sales order not found' ? 404 : 409
      throw createError({ statusCode: status, statusMessage: err.message })
    }
    throw err
  }
})
