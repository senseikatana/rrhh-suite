import { getErpContext } from '../../../../utils/erp'
import { createOrder } from '../../../../services/erp-sales'
import { parseOrThrow, salesOrderCreate } from '../../../../utils/erp-schemas'

/**
 * Creación de un pedido de venta con sus líneas.
 * El número correlativo y el total se calculan en el servicio.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)
  const body = parseOrThrow(salesOrderCreate, await readBody(event), 'Invalid sales order')

  const order = await db.transaction(async (tx) => {
    return createOrder(tx, orgId, actor, {
      customerId: body.customerId,
      deliveryDate: body.deliveryDate ?? null,
      notes: body.notes ?? null,
      lines: body.lines,
    })
  })

  setResponseStatus(event, 201)
  return order
})
