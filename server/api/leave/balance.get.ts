import { and, eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import {
  getBalanceForType,
  getOvertimeSummary,
  type BalanceForTypeResult,
} from '../../utils/leave'

export default defineEventHandler(async (event) => {
  const { db, user, employee, org, settings } = await getContext(event)
  const query = getQuery(event)

  const year = Number(query.year ?? new Date().getFullYear())
  const targetId = typeof query.employeeId === 'string' ? query.employeeId : null

  if (targetId && targetId !== employee?.id && !isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para consultar otro empleado' })
  }

  const types = await db
    .select()
    .from(schema.leaveTypes)
    .where(and(eq(schema.leaveTypes.orgId, org.id), eq(schema.leaveTypes.active, true)))

  let target = employee
  if (targetId) {
    const [row] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, targetId))
      .limit(1)

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado' })
    }
    target = row
  }

  // Usuarios sin ficha de empleado (por ejemplo, un registro recién creado):
  // se devuelve un saldo vacío en lugar de romper el panel.
  if (!target) {
    return {
      year,
      employee: null,
      balances: [],
      overtime: null,
      types,
    }
  }

  const balances: BalanceForTypeResult[] = []
  for (const type of types) {
    const balance = await getBalanceForType(db, {
      employee: target,
      orgId: org.id,
      leaveType: type,
      year,
      settings,
    })
    if (balance) balances.push(balance)
  }

  return {
    year,
    employee: {
      id: target.id,
      firstName: target.firstName,
      lastName: target.lastName,
      departmentId: target.departmentId,
      startDate: target.startDate,
    },
    balances,
    overtime: await getOvertimeSummary(db, target.id, settings),
    types,
  }
})
