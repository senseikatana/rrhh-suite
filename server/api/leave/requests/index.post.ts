import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../../database/schema'
import { getApproverForDepartment, getContext } from '../../../utils/hr'
import { recordAudit } from '../../../utils/audit'
import { queueEmail, flushEmails } from '../../../utils/mailer'
import {
  countLeaveDays,
  isValidIsoDate,
  maxConcurrentAbsences,
} from '../../../services/leave/working-days'
import { rangesOverlap, validateLeaveRequest } from '../../../services/leave/validation'
import {
  getBalanceForType,
  getDepartmentAbsences,
  getDepartmentSize,
  getEmployeeActiveRequests,
  getHolidayDates,
} from '../../../utils/leave'

const createSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string().refine(isValidIsoDate, 'Fecha de inicio inválida'),
  endDate: z.string().refine(isValidIsoDate, 'Fecha de fin inválida'),
  reason: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const { db, user, employee, org, settings } = await getContext(event)

  if (!employee) {
    throw createError({ statusCode: 400, statusMessage: 'Tu usuario no tiene ficha de empleado' })
  }

  const parsed = createSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues.map((issue) => issue.message).join('. '),
    })
  }

  const { leaveTypeId, startDate, endDate, reason } = parsed.data

  const [leaveType] = await db
    .select()
    .from(schema.leaveTypes)
    .where(and(eq(schema.leaveTypes.id, leaveTypeId), eq(schema.leaveTypes.orgId, org.id)))
    .limit(1)

  if (!leaveType || !leaveType.active) {
    throw createError({ statusCode: 404, statusMessage: 'Tipo de permiso no encontrado' })
  }

  const startYear = Number(startDate.slice(0, 4))
  const endYear = Number(endDate.slice(0, 4))
  const holidays = [
    ...new Set([
      ...(await getHolidayDates(db, org.id, startYear)),
      ...(await getHolidayDates(db, org.id, endYear)),
    ]),
  ]

  const days = countLeaveDays(startDate, endDate, {
    mode: settings.vacationMode,
    holidays,
    workweek: settings.workweek,
  })

  let availableDays = Number.POSITIVE_INFINITY
  if (leaveType.countsAgainstBalance) {
    const balance = await getBalanceForType(db, {
      employee,
      orgId: org.id,
      leaveType,
      year: startYear,
      settings,
    })
    availableDays = balance?.availableDays ?? 0
  }

  const existing = await getEmployeeActiveRequests(db, employee.id)
  const overlaps = existing.filter((request) =>
    rangesOverlap(
      { startDate, endDate },
      { startDate: request.startDate, endDate: request.endDate },
    ),
  )

  let coverage: {
    departmentSize: number
    minCoverage: number
    maxConcurrentAbsences: number
  } | null = null

  if (leaveType.countsAgainstBalance && employee.departmentId) {
    const [department] = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, employee.departmentId))
      .limit(1)

    if (department) {
      coverage = {
        departmentSize: await getDepartmentSize(db, department.id),
        minCoverage: department.minCoverage,
        maxConcurrentAbsences: maxConcurrentAbsences(
          { startDate, endDate },
          await getDepartmentAbsences(db, department.id, employee.id),
        ),
      }
    }
  }

  const validation = validateLeaveRequest({
    startDate,
    endDate,
    requestedDays: days,
    availableDays,
    today: new Date().toISOString().slice(0, 10),
    minNoticeDays:
      leaveType.requiresApproval && leaveType.countsAgainstBalance ? settings.minNoticeDays : 0,
    overlaps,
    coverage,
  })

  if (!validation.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: validation.errors.join(' '),
      data: { errors: validation.errors },
    })
  }

  const status = leaveType.requiresApproval ? 'pending' : 'approved'
  const id = crypto.randomUUID()
  const now = new Date()

  await db.insert(schema.leaveRequests).values({
    id,
    orgId: org.id,
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate,
    endDate,
    days,
    status,
    reason: reason ?? null,
    decidedBy: status === 'approved' ? employee.id : null,
    decidedAt: status === 'approved' ? now : null,
    createdAt: now,
    updatedAt: now,
  })

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'leave.request.create',
    entity: 'leave_request',
    entityId: id,
    after: { employeeId: employee.id, leaveTypeId, startDate, endDate, days, status },
  })

  if (status === 'pending') {
    const approver = await getApproverForDepartment(db, org.id, employee.departmentId)
    if (approver) {
      await queueEmail(db, {
        employeeId: approver.id,
        email: approver.email,
        type: 'leave.request.pending',
        subject: `Nueva solicitud de ${leaveType.name} de ${employee.firstName} ${employee.lastName}`,
        body: `${employee.firstName} ${employee.lastName} solicita ${days} día(s) de ${leaveType.name} del ${startDate} al ${endDate}.\nMotivo: ${reason ?? 'sin motivo indicado'}.`,
      })
    }
  }

  void flushEmails(db).catch((error) => console.error('[mail]', error))

  return { id, days, status, warnings: [] as string[] }
})
