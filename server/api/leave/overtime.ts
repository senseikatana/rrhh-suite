import { eq } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { getOvertimeSummary } from '../../utils/leave'
import { recordAudit } from '../../utils/audit'

const createSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().positive().max(24),
  type: z.enum(['accrued', 'used', 'adjustment']).default('accrued'),
  note: z.string().max(300).optional(),
})

export default defineEventHandler(async (event) => {
  const { db, user, employee, org, settings } = await getContext(event)

  if (event.method === 'GET') {
    const query = getQuery(event)
    const targetId = typeof query.employeeId === 'string' ? query.employeeId : employee?.id

    if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Empleado no indicado' })
    if (targetId !== employee?.id && !isManagerOrAdmin(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Sin permisos' })
    }

    return getOvertimeSummary(db, targetId, settings)
  }

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos' })
  }

  const parsed = createSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Datos de bolsa de horas inválidos' })
  }

  const [targetEmployee] = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.id, parsed.data.employeeId))
    .limit(1)

  if (!targetEmployee || targetEmployee.orgId !== org.id) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado' })
  }

  const id = crypto.randomUUID()
  await db.insert(schema.overtimeLedger).values({
    id,
    employeeId: parsed.data.employeeId,
    date: parsed.data.date,
    hours: parsed.data.hours,
    type: parsed.data.type,
    note: parsed.data.note ?? null,
    createdAt: new Date(),
  })

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'overtime.create',
    entity: 'overtime_entry',
    entityId: id,
    after: parsed.data,
  })

  return { ok: true, id }
})
