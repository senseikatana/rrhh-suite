import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'
import {
  changeStatus,
  getOrderLines,
  TransitionError,
  type SalesOrderStatus,
} from '../../../../../services/erp-sales'
import { parseOrThrow, salesStatusChange } from '../../../../../utils/erp-schemas'

/**
 * Avanza un pedido por su flujo de trabajo.
 * Se comprueban el grafo de transiciones y el rol del actor en el servidor.
 * Una transición rechazada devuelve 409 con el motivo.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)
  const orderId = getRouterParam(event, 'id')
  const body = parseOrThrow(salesStatusChange, await readBody(event), 'Invalid status change')

  try {
    return await db.transaction(async (tx) => {
      // Orden y líneas se leen DENTRO de la transacción para evitar TOCTOU:
      // leer fuera deja validar el grafo contra un snapshot stale.
      const [order] = await tx
        .select()
        .from(schema.erpSalesOrders)
        .where(eq(schema.erpSalesOrders.id, orderId!))

      if (!order || order.orgId !== orgId) {
        throw new TransitionError('Sales order not found')
      }

      const lines = await getOrderLines(tx, order.id)
      return changeStatus(tx, orgId, actor, order, lines, {
        status: body.status as SalesOrderStatus,
        reason: body.note ?? null,
      })
    })
  } catch (err) {
    if (err instanceof TransitionError) {
      const status = err.message === 'Sales order not found' ? 404 : 409
      throw createError({ statusCode: status, statusMessage: err.message })
    }
    throw err
  }
})
