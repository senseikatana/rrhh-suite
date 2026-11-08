import { eq } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../../../database/schema'
import { canApprove, getContext } from '../../../../utils/hr'
import { recordAudit } from '../../../../utils/audit'
import { flushEmails, queueEmail } from '../../../../utils/mailer'
import { getBalanceForType } from '../../../../utils/leave'

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const { db, user, employee, org, settings } = await getContext(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Solicitud no indicada' })

  const parsed = decisionSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Decisión inválida' })
  }

  const [request] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, id))
    .limit(1)

  if (!request) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })

  const [requestEmployee] = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.id, request.employeeId))
    .limit(1)

  if (!requestEmployee) {
    throw createError({ statusCode: 404, statusMessage: 'Empleado no encontrado' })
  }

  if (!(await canApprove(db, user, employee ?? undefined, requestEmployee.departmentId))) {
    throw createError({ statusCode: 403, statusMessage: 'No puedes aprobar esta solicitud' })
  }

  if (request.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'La solicitud ya no está pendiente' })
  }

  const [leaveType] = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.id, request.leaveTypeId))
    .limit(1)

  if (parsed.data.decision === 'approve' && leaveType?.countsAgainstBalance) {
    const balance = await getBalanceForType(db, {
      employee: requestEmployee,
      orgId: org.id,
      leaveType,
      year: Number(request.startDate.slice(0, 4)),
      settings,
    })

    if (balance && balance.availableDays < 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `El saldo ya no cubre esta solicitud (disponible: ${balance.availableDays} días).`,
      })
    }
  }

  const now = new Date()
  await db
    .update(schema.leaveRequests)
    .set({
      status: parsed.data.decision === 'approve' ? 'approved' : 'rejected',
      decidedBy: employee?.id ?? null,
      decidedAt: now,
      decisionNote: parsed.data.note ?? null,
      updatedAt: now,
    })
    .where(eq(schema.leaveRequests.id, id))

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: `leave.request.${parsed.data.decision}`,
    entity: 'leave_request',
    entityId: id,
    before: { status: request.status },
    after: { status: parsed.data.decision === 'approve' ? 'approved' : 'rejected' },
  })

  await queueEmail(db, {
    employeeId: requestEmployee.id,
    email: requestEmployee.email,
    type: `leave.request.${parsed.data.decision}d`,
    subject:
      parsed.data.decision === 'approve'
        ? 'Tu solicitud de vacaciones ha sido aprobada'
        : 'Tu solicitud de vacaciones ha sido rechazada',
    body: `Solicitud del ${request.startDate} al ${request.endDate} (${request.days} días).${parsed.data.note ? `\nNota: ${parsed.data.note}` : ''}`,
  })

  void flushEmails(db).catch((error) => console.error('[mail]', error))

  return { ok: true, status: parsed.data.decision === 'approve' ? 'approved' : 'rejected' }
})
