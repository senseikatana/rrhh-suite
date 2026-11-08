import { desc, eq } from 'drizzle-orm'
import * as schema from '../database/schema'
import { getContext } from '../utils/hr'

export default defineEventHandler(async (event) => {
  const { db, user, org } = await getContext(event)

  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo administración puede ver la auditoría' })
  }

  return db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, org.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(200)
})
