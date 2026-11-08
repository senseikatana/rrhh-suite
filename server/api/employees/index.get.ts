import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const { db, user, org } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos' })
  }

  const rows = await db
    .select({
      id: schema.employees.id,
      firstName: schema.employees.firstName,
      lastName: schema.employees.lastName,
      email: schema.employees.email,
      phone: schema.employees.phone,
      pin: schema.employees.pin,
      position: schema.employees.position,
      startDate: schema.employees.startDate,
      endDate: schema.employees.endDate,
      weeklyHours: schema.employees.weeklyHours,
      active: schema.employees.active,
      departmentId: schema.employees.departmentId,
      departmentName: schema.departments.name,
      departmentColor: schema.departments.color,
      userId: schema.employees.userId,
      role: schema.user.role,
    })
    .from(schema.employees)
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .leftJoin(schema.user, eq(schema.employees.userId, schema.user.id))
    .where(eq(schema.employees.orgId, org.id))

  return rows
})
