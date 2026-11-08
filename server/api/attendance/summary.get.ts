import { z } from 'zod'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { getAttendanceSummary, getEmployeeById } from '../../utils/attendance'
import { isValidIsoDate } from '../../services/leave/working-days'
import {
  endOfMonthKey,
  localDateKey,
  startOfMonthKey,
} from '../../services/attendance/time'

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  employeeId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const { db, user, employee, org, settings } = await getContext(event)

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Consulta inválida' })
  }

  const today = localDateKey(new Date(), org.timezone)
  const from =
    parsed.data.from && isValidIsoDate(parsed.data.from)
      ? parsed.data.from
      : startOfMonthKey(today)
  const to =
    parsed.data.to && isValidIsoDate(parsed.data.to) ? parsed.data.to : endOfMonthKey(today)

  if (to < from) {
    throw createError({ statusCode: 400, statusMessage: 'El rango de fechas está invertido' })
  }

  const targetId = parsed.data.employeeId

  let target = employee
  if (targetId) {
    if (targetId !== employee?.id && !isManagerOrAdmin(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Sin permisos' })
    }
    target = await getEmployeeById(db, org.id, targetId)
  }

  if (!target) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tu usuario no tiene ficha de empleado.',
    })
  }

  return getAttendanceSummary(db, target, org, settings, from, to)
})
