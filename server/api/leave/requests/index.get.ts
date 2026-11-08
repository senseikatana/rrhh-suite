import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../../database/schema'
import { getContext } from '../../../utils/hr'
import { isManagerOrAdmin } from '../../../utils/session'

const querySchema = z.object({
  scope: z.enum(['mine', 'team', 'all']).default('mine'),
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'cancelled']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const { db, user, employee, org } = await getContext(event)

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Parámetros de consulta inválidos' })
  }

  const { scope, status, departmentId } = parsed.data
  const year = parsed.data.year ?? new Date().getFullYear()

  if (scope !== 'mine' && !isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para ver solicitudes de otros' })
  }

  const conditions: SQL[] = [
    eq(schema.leaveRequests.orgId, org.id),
    lte(schema.leaveRequests.startDate, `${year}-12-31`),
    gte(schema.leaveRequests.endDate, `${year}-01-01`),
  ]

  if (scope === 'mine') {
    if (!employee) return []
    conditions.push(eq(schema.leaveRequests.employeeId, employee.id))
  } else if (scope === 'team') {
    if (departmentId) {
      conditions.push(eq(schema.employees.departmentId, departmentId))
    } else if (user.role === 'manager' && employee?.departmentId) {
      conditions.push(eq(schema.employees.departmentId, employee.departmentId))
    }
  }

  if (status) conditions.push(eq(schema.leaveRequests.status, status))

  const rows = await db
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
      reason: schema.leaveRequests.reason,
      decisionNote: schema.leaveRequests.decisionNote,
      decidedAt: schema.leaveRequests.decidedAt,
      createdAt: schema.leaveRequests.createdAt,
    })
    .from(schema.leaveRequests)
    .innerJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .where(and(...conditions))
    .orderBy(desc(schema.leaveRequests.createdAt))

  return rows
})
