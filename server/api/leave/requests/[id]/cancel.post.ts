import { eq } from 'drizzle-orm'
import * as schema from '../../../../database/schema'
import { canApprove, getContext } from '../../../../utils/hr'
import { recordAudit } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const { db, user, employee, org } = await getContext(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Solicitud no indicada' })

  const [request] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, id))
    .limit(1)

  if (!request) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })

  const isOwner = employee?.id === request.employeeId
  const [requestEmployee] = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.id, request.employeeId))
    .limit(1)

  const canManage =
    user.role === 'admin' ||
    (await canApprove(db, user, employee ?? undefined, requestEmployee?.departmentId ?? null))

  if (!isOwner && !canManage) {
    throw createError({ statusCode: 403, statusMessage: 'No puedes cancelar esta solicitud' })
  }

  if (!['pending', 'approved'].includes(request.status)) {
    throw createError({ statusCode: 409, statusMessage: 'La solicitud no se puede cancelar' })
  }

  const now = new Date()
  await db
    .update(schema.leaveRequests)
    .set({ status: 'cancelled', updatedAt: now })
    .where(eq(schema.leaveRequests.id, id))

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'leave.request.cancel',
    entity: 'leave_request',
    entityId: id,
    before: { status: request.status },
    after: { status: 'cancelled' },
  })

  return { ok: true, status: 'cancelled' }
})
