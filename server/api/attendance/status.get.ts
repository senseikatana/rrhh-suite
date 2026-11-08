import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { getAttendanceStatus, getEmployeeById } from '../../utils/attendance'

export default defineEventHandler(async (event) => {
  const { db, user, employee, org, settings } = await getContext(event)
  const query = getQuery(event)
  const targetId = typeof query.employeeId === 'string' ? query.employeeId : null

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

  return getAttendanceStatus(db, target, org, settings)
})
