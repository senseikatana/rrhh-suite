import { eq } from 'drizzle-orm'
import * as schema from '../../../../../database/schema'
import { getErpContext } from '../../../../../utils/erp'
import {
  decideQuality,
  WorkflowError,
} from '../../../../../services/erp-purchasing'
import { parseOrThrow, qualityDecision } from '../../../../../utils/erp-schemas'

/**
 * Aprobar o rechazar mercancía recibida.
 * La aprobación publica las cantidades recibidas al stock exactamente una vez.
 * Un rechazo devuelve el pedido a OPEN sin tocar el inventario.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)
  const orderId = getRouterParam(event, 'id')
  const body = parseOrThrow(qualityDecision, await readBody(event), 'Invalid quality decision')

  try {
    return await db.transaction(async (tx) => {
      // Orden y líneas se leen DENTRO de la transacción para evitar TOCTOU:
      // leer fuera deja actuar sobre un snapshot stale ante decisiones concurrentes.
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

      return decideQuality(tx, orgId, actor, order, lines, {
        passed: body.passed,
        note: body.note ?? null,
        lines: (body.lines as { lineId: string; status: 'PENDING' | 'PASSED' | 'FAILED' }[] | null) ?? null,
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
