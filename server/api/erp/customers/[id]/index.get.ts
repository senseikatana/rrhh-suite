import { eq } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'

/** Detalle de un cliente. */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)
  const customerId = getRouterParam(event, 'id')

  const [customer] = await db
    .select()
    .from(schema.erpCustomers)
    .where(eq(schema.erpCustomers.id, customerId!))
  if (!customer || customer.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
  }
  return customer
})
