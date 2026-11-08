import { z } from 'zod'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { recordAudit } from '../../utils/audit'
import {
  getAttendanceSummary,
  getEmployeeById,
} from '../../utils/attendance'
import { isValidIsoDate } from '../../services/leave/working-days'
import { zonedDateTime } from '../../services/attendance/time'

const correctionSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().refine(isValidIsoDate, 'Fecha inválida'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)'),
  direction: z.enum(['in', 'out']),
  note: z.string().max(300).optional(),
})

export default defineEventHandler(async (event) => {
  const { db, user, org, settings } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para corregir fichajes' })
  }

  const parsed = correctionSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues.map((issue) => issue.message).join('. '),
    })
  }

  const target = await getEmployeeById(db, org.id, parsed.data.employeeId)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado' })
  }

  const occurredAt = zonedDateTime(parsed.data.date, parsed.data.time, org.timezone)

  if (occurredAt.getTime() > Date.now() + 60_000) {
    throw createError({ statusCode: 400, statusMessage: 'No se pueden fichar horas futuras' })
  }

  const id = crypto.randomUUID()
  const userAgent = getHeader(event, 'user-agent') ?? null

  await db.insert(schema.clockEvents).values({
    id,
    orgId: org.id,
    employeeId: target.id,
    occurredAt,
    direction: parsed.data.direction,
    source: 'web',
    ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
    userAgent,
    corrected: true,
    note: parsed.data.note?.trim() || 'Corrección manual',
  })

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'attendance.correction',
    entity: 'clock_event',
    entityId: id,
    after: {
      employeeId: target.id,
      date: parsed.data.date,
      time: parsed.data.time,
      direction: parsed.data.direction,
      note: parsed.data.note ?? null,
    },
  })

  return getAttendanceSummary(
    db,
    target,
    org,
    settings,
    parsed.data.date,
    parsed.data.date,
  )
})
