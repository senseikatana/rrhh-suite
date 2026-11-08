import ExcelJS from 'exceljs'
import { and, eq, gte, lte } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { getBalanceForType, getHolidayDates } from '../../utils/leave'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' },
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: 'middle' }
  })
  row.height = 22
}

export default defineEventHandler(async (event) => {
  const { db, user, org, settings } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para exportar' })
  }

  const query = getQuery(event)
  const year = Number(query.year ?? new Date().getFullYear())

  const employees = await db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.orgId, org.id), eq(schema.employees.active, true)))

  const departments = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.orgId, org.id))

  const types = await db
    .select()
    .from(schema.leaveTypes)
    .where(eq(schema.leaveTypes.orgId, org.id))

  const requests = await db
    .select({
      employeeFirstName: schema.employees.firstName,
      employeeLastName: schema.employees.lastName,
      typeName: schema.leaveTypes.name,
      startDate: schema.leaveRequests.startDate,
      endDate: schema.leaveRequests.endDate,
      days: schema.leaveRequests.days,
      status: schema.leaveRequests.status,
      reason: schema.leaveRequests.reason,
    })
    .from(schema.leaveRequests)
    .innerJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .where(
      and(
        eq(schema.leaveRequests.orgId, org.id),
        lte(schema.leaveRequests.startDate, `${year}-12-31`),
        gte(schema.leaveRequests.endDate, `${year}-01-01`),
      ),
    )

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RRHH Suite'
  workbook.created = new Date()

  const employeeSheet = workbook.addWorksheet('Empleados')
  employeeSheet.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'Nombre', key: 'firstName', width: 16 },
    { header: 'Apellidos', key: 'lastName', width: 20 },
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Puesto', key: 'position', width: 24 },
    { header: 'Fecha alta', key: 'startDate', width: 14 },
    { header: 'Horas/semana', key: 'weeklyHours', width: 14 },
    { header: 'PIN', key: 'pin', width: 10 },
  ]
  styleHeader(employeeSheet.getRow(1))

  for (const employee of employees) {
    const department = departments.find((item) => item.id === employee.departmentId)
    employeeSheet.addRow({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: department?.name ?? '',
      position: employee.position ?? '',
      startDate: employee.startDate,
      weeklyHours: employee.weeklyHours,
      pin: employee.pin ?? '',
    })
  }

  const balanceSheet = workbook.addWorksheet('Saldos')
  const balanceColumns: Partial<ExcelJS.Column>[] = [
    { header: 'Empleado', key: 'employee', width: 28 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Alta', key: 'startDate', width: 14 },
  ]

  for (const type of types.filter((item) => item.countsAgainstBalance)) {
    balanceColumns.push(
      { header: `${type.name} · derecho`, key: `${type.code}_total`, width: 18 },
      { header: `${type.name} · disfrutado`, key: `${type.code}_used`, width: 20 },
      { header: `${type.name} · pendiente`, key: `${type.code}_reserved`, width: 18 },
      { header: `${type.name} · disponible`, key: `${type.code}_available`, width: 20 },
    )
  }

  balanceSheet.columns = balanceColumns
  styleHeader(balanceSheet.getRow(1))

  for (const employee of employees) {
    const department = departments.find((item) => item.id === employee.departmentId)
    const row: Record<string, unknown> = {
      employee: `${employee.firstName} ${employee.lastName}`,
      department: department?.name ?? '',
      startDate: employee.startDate,
    }

    for (const type of types.filter((item) => item.countsAgainstBalance)) {
      const balance = await getBalanceForType(db, {
        employee,
        orgId: org.id,
        leaveType: type,
        year,
        settings,
      })
      row[`${type.code}_total`] = balance?.totalDays ?? 0
      row[`${type.code}_used`] = balance?.usedDays ?? 0
      row[`${type.code}_reserved`] = balance?.reservedDays ?? 0
      row[`${type.code}_available`] = balance?.availableDays ?? 0
    }

    balanceSheet.addRow(row)
  }

  const requestSheet = workbook.addWorksheet('Solicitudes')
  requestSheet.columns = [
    { header: 'Empleado', key: 'employee', width: 28 },
    { header: 'Tipo', key: 'type', width: 22 },
    { header: 'Inicio', key: 'startDate', width: 14 },
    { header: 'Fin', key: 'endDate', width: 14 },
    { header: 'Días', key: 'days', width: 10 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Motivo', key: 'reason', width: 40 },
  ]
  styleHeader(requestSheet.getRow(1))

  const statusLabel: Record<string, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
  }

  for (const request of requests) {
    requestSheet.addRow({
      employee: `${request.employeeFirstName} ${request.employeeLastName}`,
      type: request.typeName,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      status: statusLabel[request.status] ?? request.status,
      reason: request.reason ?? '',
    })
  }

  const holidaySheet = workbook.addWorksheet('Festivos')
  holidaySheet.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Año', key: 'year', width: 8 },
  ]
  styleHeader(holidaySheet.getRow(1))
  for (const date of await getHolidayDates(db, org.id, year)) {
    holidaySheet.addRow({ date, year })
  }

  const calendarSheet = workbook.addWorksheet('Calendario')
  calendarSheet.columns = [
    { header: 'Empleado', key: 'employee', width: 28 },
    { header: 'Mes', key: 'month', width: 8 },
    { header: 'Días aprobados', key: 'approved', width: 16 },
    { header: 'Días pendientes', key: 'pending', width: 16 },
  ]
  styleHeader(calendarSheet.getRow(1))

  for (const employee of employees) {
    const own = requests.filter(
      (request) =>
        request.employeeFirstName === employee.firstName &&
        request.employeeLastName === employee.lastName,
    )

    for (let month = 1; month <= 12; month += 1) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const monthRequests = own.filter((request) => request.startDate.startsWith(prefix))
      calendarSheet.addRow({
        employee: `${employee.firstName} ${employee.lastName}`,
        month,
        approved: monthRequests
          .filter((request) => request.status === 'approved')
          .reduce((sum, request) => sum + request.days, 0),
        pending: monthRequests
          .filter((request) => request.status === 'pending')
          .reduce((sum, request) => sum + request.days, 0),
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `rrhh-${org.slug}-${year}.xlsx`

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
