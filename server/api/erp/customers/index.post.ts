import { and, eq } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'
import { recordActivity } from '../../../services/erp-activity'
import { customerCreate, parseOrThrow } from '../../../utils/erp-schemas'

/**
 * Alta de cliente. Abierto a admin, compras y logística
 * (logística registra entregas para clientes).
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (!['admin', 'buyer', 'logistics'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, buyer, logistics`,
    })
  }

  const body = parseOrThrow(customerCreate, await readBody(event), 'Invalid customer')

  const [existing] = await db
    .select()
    .from(schema.erpCustomers)
    .where(and(eq(schema.erpCustomers.orgId, orgId), eq(schema.erpCustomers.code, body.code)))
    .limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Customer code '${body.code}' already exists` })
  }

  const customer = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.erpCustomers)
      .values({
        id: crypto.randomUUID(),
        orgId,
        code: body.code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        postalCode: body.postalCode ?? null,
        country: body.country,
        taxId: body.taxId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await recordActivity(tx, {
      orgId,
      actorId: actor.id,
      actorUsername: actor.username,
      entity: 'customer',
      action: 'created',
      entityId: created!.id,
      summary: `Created customer ${created!.code}`,
    })

    return created!
  })

  setResponseStatus(event, 201)
  return customer
})
