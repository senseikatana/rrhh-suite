import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { getTeamAttendance } from '../../utils/attendance'

export default defineEventHandler(async (event) => {
  const { db, user, org, settings } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para ver el equipo' })
  }

  const now = new Date()

  return {
    at: now,
    rows: await getTeamAttendance(db, org, settings, now),
  }
})
