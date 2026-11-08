import ExcelJS from 'exceljs'
import { and, eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { getAttendanceSummary } from '../../utils/attendance'
import { isValidIsoDate } from '../../services/leave/working-days'
import {
  endOfMonthKey,
  localDateKey,
  localTime,
  minutesToHours,
  startOfMonthKey,
} from '../../services/attendance/time'

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
  const today = localDateKey(new Date(), org.timezone)
  const from =
    typeof query.from === 'string' && isValidIsoDate(query.from)
      ? query.from
      : startOfMonthKey(today)
  const to =
    typeof query.to === 'string' && isValidIsoDate(query.to) ? query.to : endOfMonthKey(today)
  const employeeId = typeof query.employeeId === 'string' ? query.employeeId : null

  const employees = await db
    .select()
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.orgId, org.id),
        eq(schema.employees.active, true),
        employeeId ? eq(schema.employees.id, employeeId) : undefined,
      ),
    )
    .orderBy(schema.employees.lastName, schema.employees.firstName)

  const departments = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.orgId, org.id))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RRHH Suite'
  workbook.created = new Date()

  const registerSheet = workbook.addWorksheet('Registro')
  registerSheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Empleado', key: 'employee', width: 28 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Entrada', key: 'entry', width: 10 },
    { header: 'Salida', key: 'exit', width: 10 },
    { header: 'Horas', key: 'hours', width: 10, style: { numFmt: '0.00' } },
    { header: 'Incidencia', key: 'incident', width: 46 },
  ]
  styleHeader(registerSheet.getRow(1))

  const dailySheet = workbook.addWorksheet('Jornada diaria')
  dailySheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Empleado', key: 'employee', width: 28 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Horario', key: 'schedule', width: 14 },
    { header: 'Entrada', key: 'entry', width: 10 },
    { header: 'Salida', key: 'exit', width: 10 },
    { header: 'Retraso (min)', key: 'late', width: 13 },
    { header: 'Anticipada (min)', key: 'early', width: 16 },
    { header: 'Trabajado', key: 'worked', width: 12, style: { numFmt: '0.00' } },
    { header: 'Esperado', key: 'expected', width: 12, style: { numFmt: '0.00' } },
    { header: 'Saldo', key: 'balance', width: 10, style: { numFmt: '0.00' } },
    { header: 'Extra', key: 'overtime', width: 10, style: { numFmt: '0.00' } },
    { header: 'Defecto', key: 'deficit', width: 10, style: { numFmt: '0.00' } },
    { header: 'Incidencias', key: 'incidents', width: 46 },
  ]
  styleHeader(dailySheet.getRow(1))

  const summarySheet = workbook.addWorksheet('Resumen')
  summarySheet.columns = [
    { header: 'Empleado', key: 'employee', width: 28 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Días con fichaje', key: 'days', width: 16 },
    { header: 'Trabajado', key: 'worked', width: 12, style: { numFmt: '0.00' } },
    { header: 'Esperado', key: 'expected', width: 12, style: { numFmt: '0.00' } },
    { header: 'Saldo', key: 'balance', width: 10, style: { numFmt: '0.00' } },
    { header: 'Extra', key: 'overtime', width: 10, style: { numFmt: '0.00' } },
    { header: 'Defecto', key: 'deficit', width: 10, style: { numFmt: '0.00' } },
    { header: 'Retraso (min)', key: 'late', width: 13 },
    { header: 'Anticipada (min)', key: 'early', width: 16 },
  ]
  styleHeader(summarySheet.getRow(1))

  for (const employee of employees) {
    const department = departments.find((item) => item.id === employee.departmentId)
    const name = `${employee.firstName} ${employee.lastName}`
    const summary = await getAttendanceSummary(db, employee, org, settings, from, to)
    const scheduleStart = employee.scheduleStart ?? settings.defaultScheduleStart
    const scheduleEnd = employee.scheduleEnd ?? settings.defaultScheduleEnd
    const scheduleLabel =
      scheduleStart && scheduleEnd ? `${scheduleStart}–${scheduleEnd}` : ''

    for (const day of summary.days) {
      for (const session of day.sessions) {
        registerSheet.addRow({
          date: day.date,
          employee: name,
          department: department?.name ?? '',
          entry: localTime(session.start, org.timezone),
          exit: session.end ? localTime(session.end, org.timezone) : '—',
          hours: minutesToHours(session.minutes),
          incident: session.open ? 'Sesión abierta' : day.anomalies.join(' '),
        })
      }

      if (day.sessions.length > 0) {
        dailySheet.addRow({
          date: day.date,
          employee: name,
          department: department?.name ?? '',
          schedule: scheduleLabel,
          entry: day.firstIn ? localTime(day.firstIn, org.timezone) : '—',
          exit: day.lastOut ? localTime(day.lastOut, org.timezone) : '—',
          late: day.lateMinutes,
          early: day.earlyLeaveMinutes,
          worked: minutesToHours(day.workedMinutes),
          expected: minutesToHours(day.expectedMinutes),
          balance: minutesToHours(day.balanceMinutes),
          overtime: minutesToHours(day.overtimeMinutes),
          deficit: minutesToHours(day.deficitMinutes),
          incidents: day.anomalies.join(' '),
        })
      }
    }

    summarySheet.addRow({
      employee: name,
      department: department?.name ?? '',
      days: summary.days.filter((day) => day.sessions.length > 0).length,
      worked: minutesToHours(summary.workedMinutes),
      expected: minutesToHours(summary.expectedMinutes),
      balance: minutesToHours(summary.balanceMinutes),
      overtime: minutesToHours(summary.overtimeMinutes),
      deficit: minutesToHours(summary.deficitMinutes),
      late: summary.days.reduce((sum, day) => sum + day.lateMinutes, 0),
      early: summary.days.reduce((sum, day) => sum + day.earlyLeaveMinutes, 0),
    })
  }

  for (const sheet of [registerSheet, dailySheet, summarySheet]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}1` }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `fichajes-${org.slug}-${from}_${to}.xlsx`

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
