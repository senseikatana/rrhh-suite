import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'
import {
  receive,
  WorkflowError,
} from '../../../../../services/erp-purchasing'
import { parseOrThrow, receiptRequest } from '../../../../../utils/erp-schemas'

/**
 * Registro de recepción de mercancía.
 * La recepción NO aumenta stock. Si la empresa exige control de calidad, el
 * pedido pasa a QC_PENDING y espera una decisión de Calidad.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)
  const orderId = getRouterParam(event, 'id')
  const body = parseOrThrow(receiptRequest, await readBody(event), 'Invalid receipt')

  try {
    return await db.transaction(async (tx) => {
      // Orden y líneas se leen DENTRO de la transacción para evitar TOCTOU.
      const [order] = await tx
        .select()
        .from(schema.erpPurchaseOrders)
        .where(eq(schema.erpPurchaseOrders.id, orderId!))

      if (!order || order.orgId !== orgId) {
        throw new WorkflowError('Purchase order not found')
      }

      const lines = await tx
        .select()
        .from(schema.erpPurchaseOrderLines)
        .where(eq(schema.erpPurchaseOrderLines.orderId, order.id))

      return receive(tx, orgId, actor, order, lines, {
        reference: body.reference ?? null,
        lines: body.lines ?? null,
      })
    })
  } catch (err) {
    if (err instanceof WorkflowError) {
      const status = err.message === 'Purchase order not found' ? 404 : 409
      throw createError({ statusCode: status, statusMessage: err.message })
    }
    throw err
  }
})
