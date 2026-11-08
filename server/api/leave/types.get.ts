import { and, eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'

export default defineEventHandler(async (event) => {
  const { db, org } = await getContext(event)

  return db
    .select()
    .from(schema.leaveTypes)
    .where(and(eq(schema.leaveTypes.orgId, org.id), eq(schema.leaveTypes.active, true)))
})
