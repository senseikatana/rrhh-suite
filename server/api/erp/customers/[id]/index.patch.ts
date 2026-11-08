import { eq } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { getErpContext } from '../../../../utils/erp'

/**
 * Actualización de datos maestros de un cliente.
 * Solo admin y compras (los datos maestros de clientes son de compras).
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (!['admin', 'buyer'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, buyer`,
    })
  }

  const customerId = getRouterParam(event, 'id')
  const body = await readBody(event)

  const [customer] = await db
    .select()
    .from(schema.erpCustomers)
    .where(eq(schema.erpCustomers.id, customerId!))
  if (!customer || customer.orgId !== orgId) {
    throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
  }

  const allowed = ['code', 'name', 'email', 'phone', 'address', 'city', 'postalCode', 'country', 'taxId'] as const
  const patch: Record<string, unknown> = {}
  for (const field of allowed) {
    if (body && field in body) patch[field] = body[field]
  }

  const [updated] = await db
    .update(schema.erpCustomers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.erpCustomers.id, customer.id))
    .returning()

  return updated
})
