import { getErpContext } from '../../../../utils/erp'
import {
  createOrder,
  WorkflowError,
} from '../../../../services/erp-purchasing'
import { parseOrThrow, purchaseOrderCreate } from '../../../../utils/erp-schemas'

/**
 * Alta de un pedido de compra.
 * Restringido a compras y administración; el servicio lanza WorkflowError si no.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)
  const body = parseOrThrow(purchaseOrderCreate, await readBody(event), 'Invalid purchase order')

  try {
    const order = await db.transaction(async (tx) => {
      return createOrder(tx, orgId, actor, {
        vendorId: body.vendorId,
        expectedDate: body.expectedDate ?? null,
        lines: body.lines,
      })
    })
    setResponseStatus(event, 201)
    return order
  } catch (err) {
    if (err instanceof WorkflowError) {
      throw createError({ statusCode: 403, statusMessage: err.message })
    }
    throw err
  }
})
