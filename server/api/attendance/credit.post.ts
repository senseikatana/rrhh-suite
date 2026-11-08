import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { recordAudit } from '../../utils/audit'
import { getAttendanceSummary, getEmployeeById } from '../../utils/attendance'
import { isValidIsoDate } from '../../services/leave/working-days'
import { minutesToHours } from '../../services/attendance/time'

const creditSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().refine(isValidIsoDate, 'Fecha inválida'),
})

export default defineEventHandler(async (event) => {
  const { db, user, org, settings } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos' })
  }

  const parsed = creditSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Datos inválidos' })
  }

  const target = await getEmployeeById(db, org.id, parsed.data.employeeId)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado' })
  }

  const summary = await getAttendanceSummary(
    db,
    target,
    org,
    settings,
    parsed.data.date,
    parsed.data.date,
  )

  if (summary.overtimeMinutes <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ese día no tiene horas extra que acreditar.',
    })
  }

  const note = `Fichaje ${parsed.data.date}`

  const [existing] = await db
    .select()
    .from(schema.overtimeLedger)
    .where(
      and(
        eq(schema.overtimeLedger.employeeId, target.id),
        eq(schema.overtimeLedger.date, parsed.data.date),
        eq(schema.overtimeLedger.note, note),
      ),
    )
    .limit(1)

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Las horas extra de ese día ya están acreditadas en la bolsa.',
    })
  }

  const hours = minutesToHours(summary.overtimeMinutes)
  const id = crypto.randomUUID()

  await db.insert(schema.overtimeLedger).values({
    id,
    employeeId: target.id,
    date: parsed.data.date,
    hours,
    type: 'accrued',
    note,
    createdAt: new Date(),
  })

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'attendance.credit_overtime',
    entity: 'overtime_entry',
    entityId: id,
    after: { employeeId: target.id, date: parsed.data.date, hours },
  })

  return { ok: true, hours, minutes: summary.overtimeMinutes }
})
