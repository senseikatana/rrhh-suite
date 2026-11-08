import { and, eq } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'
import { parseOrThrow, routeCreate } from '../../../utils/erp-schemas'

/**
 * Alta de una ruta de transporte. Solo admin y logística.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  if (!['admin', 'logistics'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, logistics`,
    })
  }

  const body = parseOrThrow(routeCreate, await readBody(event), 'Invalid route')

  const [existing] = await db
    .select()
    .from(schema.erpRoutes)
    .where(and(eq(schema.erpRoutes.orgId, orgId), eq(schema.erpRoutes.code, body.code)))
    .limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Route code '${body.code}' already exists` })
  }

  const [route] = await db
    .insert(schema.erpRoutes)
    .values({
      id: crypto.randomUUID(),
      orgId,
      code: body.code,
      carrier: body.carrier,
      date: body.date,
      status: body.status,
      stops: body.stops,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  setResponseStatus(event, 201)
  return route
})
