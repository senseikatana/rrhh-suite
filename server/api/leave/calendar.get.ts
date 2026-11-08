import { and, eq, gte, inArray, lte, type SQL } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'

export default defineEventHandler(async (event) => {
  const { db, user, employee, org } = await getContext(event)
  const query = getQuery(event)

  const year = Number(query.year ?? new Date().getFullYear())
  const departmentId = typeof query.departmentId === 'string' ? query.departmentId : null
  const scope = typeof query.scope === 'string' ? query.scope : 'all'

  const conditions: SQL[] = [
    eq(schema.leaveRequests.orgId, org.id),
    inArray(schema.leaveRequests.status, ['approved', 'pending']),
    lte(schema.leaveRequests.startDate, `${year}-12-31`),
    gte(schema.leaveRequests.endDate, `${year}-01-01`),
  ]

  if (scope === 'mine') {
    if (!employee) return { year, events: [] }
    conditions.push(eq(schema.leaveRequests.employeeId, employee.id))
  } else if (departmentId) {
    conditions.push(eq(schema.employees.departmentId, departmentId))
  }

  const events = await db
    .select({
      id: schema.leaveRequests.id,
      employeeId: schema.leaveRequests.employeeId,
      employeeFirstName: schema.employees.firstName,
      employeeLastName: schema.employees.lastName,
      departmentId: schema.employees.departmentId,
      departmentName: schema.departments.name,
      leaveTypeId: schema.leaveRequests.leaveTypeId,
      typeName: schema.leaveTypes.name,
      typeColor: schema.leaveTypes.color,
      typeCode: schema.leaveTypes.code,
      startDate: schema.leaveRequests.startDate,
      endDate: schema.leaveRequests.endDate,
      days: schema.leaveRequests.days,
      status: schema.leaveRequests.status,
    })
    .from(schema.leaveRequests)
    .innerJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .where(and(...conditions))

  return {
    year,
    scope,
    canSeeAll: user.role === 'admin' || user.role === 'manager',
    events,
  }
})
