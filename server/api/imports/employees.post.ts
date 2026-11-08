import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { and, eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'
import { recordAudit } from '../../utils/audit'
import { computeEntitlement } from '../../services/leave/accrual'
import { getHolidayDates } from '../../utils/leave'
import { isValidIsoDate } from '../../services/leave/working-days'
import { isValidTime } from '../../services/attendance/time'

function cellString(cell: ExcelJS.Cell): string {
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return format(value, 'yyyy-MM-dd')

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim()
    }
    if ('text' in value && value.text != null) return String(value.text).trim()
    if ('result' in value && value.result != null) return String(value.result).trim()
  }

  return ''
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>()
  const row = sheet.getRow(1)
  row.eachCell((cell, colNumber) => {
    const name = cellString(cell).toLowerCase()
    if (name) map.set(name, colNumber)
  })
  return map
}

function valueAt(row: ExcelJS.Row, headers: Map<string, number>, ...names: string[]): string {
  for (const name of names) {
    const column = headers.get(name.toLowerCase())
    if (column) {
      const value = cellString(row.getCell(column))
      if (value) return value
    }
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const { db, user, org, settings } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para importar' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.filename && part.data.length > 0)

  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Adjunta un archivo .xlsx' })
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(file.data as unknown as ArrayBuffer)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'El archivo no es un Excel válido' })
  }

  const sheet = workbook.getWorksheet('Empleados')
  if (!sheet) {
    throw createError({ statusCode: 400, statusMessage: 'Falta la hoja "Empleados"' })
  }

  const headers = headerMap(sheet)
  const result = { created: 0, updated: 0, holidays: 0, errors: [] as string[], departmentsCreated: 0 }
  const now = new Date()
  const year = now.getFullYear()

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const firstName = valueAt(row, headers, 'Nombre')
    const lastName = valueAt(row, headers, 'Apellidos')
    const email = valueAt(row, headers, 'Email').toLowerCase()

    if (!firstName && !lastName && !email) continue

    if (!firstName || !lastName || !email || !email.includes('@')) {
      result.errors.push(`Fila ${rowNumber}: faltan nombre, apellidos o email válido.`)
      continue
    }

    const departmentName = valueAt(row, headers, 'Departamento')
    const position = valueAt(row, headers, 'Puesto')
    const startDateRaw = valueAt(row, headers, 'Fecha alta')
    const startDate = isValidIsoDate(startDateRaw) ? startDateRaw : `${year}-01-01`
    const weeklyHours = Number(valueAt(row, headers, 'Horas/semana') || 40) || 40
    const scheduleStartRaw = valueAt(row, headers, 'Hora entrada')
    const scheduleEndRaw = valueAt(row, headers, 'Hora salida')
    const hasSchedule = isValidTime(scheduleStartRaw) && isValidTime(scheduleEndRaw)
    const scheduleStart = hasSchedule ? scheduleStartRaw : null
    const scheduleEnd = hasSchedule ? scheduleEndRaw : null
    const pin = valueAt(row, headers, 'PIN') || null
    const available = Number(valueAt(row, headers, 'Vacaciones disponibles') || '')

    let departmentId: string | null = null
    if (departmentName) {
      const [existingDepartment] = await db
        .select()
        .from(schema.departments)
        .where(
          and(eq(schema.departments.orgId, org.id), eq(schema.departments.name, departmentName)),
        )
        .limit(1)

      if (existingDepartment) {
        departmentId = existingDepartment.id
      } else {
        departmentId = crypto.randomUUID()
        await db.insert(schema.departments).values({
          id: departmentId,
          orgId: org.id,
          name: departmentName,
          color: '#64748b',
          minCoverage: 0,
          createdAt: now,
        })
        result.departmentsCreated += 1
      }
    }

    const [existing] = await db
      .select()
      .from(schema.employees)
      .where(and(eq(schema.employees.orgId, org.id), eq(schema.employees.email, email)))
      .limit(1)

    let employeeId: string

    if (existing) {
      employeeId = existing.id
      await db
        .update(schema.employees)
        .set({
          firstName,
          lastName,
          departmentId: departmentId ?? existing.departmentId,
          position: position || existing.position,
          startDate:
            startDateRaw && isValidIsoDate(startDateRaw) ? startDateRaw : existing.startDate,
          weeklyHours,
          ...(hasSchedule ? { scheduleStart, scheduleEnd } : {}),
          pin: pin ?? existing.pin,
          updatedAt: now,
        })
        .where(eq(schema.employees.id, existing.id))
      result.updated += 1
    } else {
      employeeId = crypto.randomUUID()
      await db.insert(schema.employees).values({
        id: employeeId,
        orgId: org.id,
        departmentId,
        firstName,
        lastName,
        email,
        phone: null,
        pin,
        position: position || null,
        startDate,
        weeklyHours,
        scheduleStart,
        scheduleEnd,
        active: true,
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(schema.contracts).values({
        id: crypto.randomUUID(),
        employeeId,
        type: 'indefinido',
        startDate,
        weeklyHours,
        createdAt: now,
      })

      result.created += 1
    }

    const [vacationType] = await db
      .select()
      .from(schema.leaveTypes)
      .where(and(eq(schema.leaveTypes.orgId, org.id), eq(schema.leaveTypes.code, 'VAC')))
      .limit(1)

    if (vacationType) {
      const [entitlementRow] = await db
        .select()
        .from(schema.leaveEntitlements)
        .where(
          and(
            eq(schema.leaveEntitlements.employeeId, employeeId),
            eq(schema.leaveEntitlements.leaveTypeId, vacationType.id),
            eq(schema.leaveEntitlements.year, year),
          ),
        )
        .limit(1)

      const [employeeRow] = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.id, employeeId))
        .limit(1)

      const entitledDays =
        Number.isFinite(available) && valueAt(row, headers, 'Vacaciones disponibles') !== ''
          ? available
          : employeeRow
            ? computeEntitlement({
                year,
                annualDays: settings.annualVacationDays,
                startDate: employeeRow.startDate,
                mode: settings.vacationMode,
                holidays: await getHolidayDates(db, org.id, year),
                workweek: settings.workweek,
                seniority: settings.seniority
                  ? { startDate: employeeRow.startDate, rule: settings.seniority }
                  : null,
              }).totalDays
            : 0

      if (entitlementRow) {
        await db
          .update(schema.leaveEntitlements)
          .set({ entitledDays })
          .where(eq(schema.leaveEntitlements.id, entitlementRow.id))
      } else {
        await db.insert(schema.leaveEntitlements).values({
          id: crypto.randomUUID(),
          employeeId,
          leaveTypeId: vacationType.id,
          year,
          entitledDays,
          carriedOverDays: 0,
          adjustmentDays: 0,
        })
      }
    }
  }

  const holidaySheet = workbook.getWorksheet('Festivos')
  if (holidaySheet) {
    const holidayHeaders = headerMap(holidaySheet)
    for (let rowNumber = 2; rowNumber <= holidaySheet.rowCount; rowNumber += 1) {
      const row = holidaySheet.getRow(rowNumber)
      const date = valueAt(row, holidayHeaders, 'Fecha')
      const name = valueAt(row, holidayHeaders, 'Nombre')
      const scopeRaw = valueAt(row, holidayHeaders, 'Ámbito', 'Ambito')
      const scope = ['nacional', 'autonomico', 'local'].includes(scopeRaw)
        ? (scopeRaw as 'nacional' | 'autonomico' | 'local')
        : 'nacional'

      if (!isValidIsoDate(date) || !name) continue

      const [existing] = await db
        .select()
        .from(schema.holidays)
        .where(and(eq(schema.holidays.orgId, org.id), eq(schema.holidays.date, date)))
        .limit(1)

      if (existing) {
        await db.update(schema.holidays).set({ name, scope }).where(eq(schema.holidays.id, existing.id))
      } else {
        await db.insert(schema.holidays).values({
          id: crypto.randomUUID(),
          orgId: org.id,
          date,
          name,
          scope,
          year: Number(date.slice(0, 4)),
        })
      }
      result.holidays += 1
    }
  }

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'employees.import',
    entity: 'employee',
    after: { created: result.created, updated: result.updated, holidays: result.holidays },
  })

  return result
})
