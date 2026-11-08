import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import type { Db } from '../database/client'
import * as schema from '../database/schema'
import { computeEntitlement } from '../services/leave/accrual'
import { computeBalance, computeOvertimeBalance, hoursToDays } from '../services/leave/balance'
import type { BalanceResult } from '../services/leave/balance'
import type { OrgSettings } from '../services/settings'

export type LeaveTypeRow = typeof schema.leaveTypes.$inferSelect
export type EmployeeRow = typeof schema.employees.$inferSelect

export async function getHolidayDates(db: Db, orgId: string, year: number): Promise<string[]> {
  const rows = await db
    .select({ date: schema.holidays.date })
    .from(schema.holidays)
    .where(and(eq(schema.holidays.orgId, orgId), eq(schema.holidays.year, year)))

  return rows.map((row) => row.date)
}

export async function getEntitlementRow(
  db: Db,
  employeeId: string,
  leaveTypeId: string,
  year: number,
) {
  const [row] = await db
    .select()
    .from(schema.leaveEntitlements)
    .where(
      and(
        eq(schema.leaveEntitlements.employeeId, employeeId),
        eq(schema.leaveEntitlements.leaveTypeId, leaveTypeId),
        eq(schema.leaveEntitlements.year, year),
      ),
    )
    .limit(1)

  return row
}

export async function getOvertimeEntries(db: Db, employeeId: string) {
  return db
    .select()
    .from(schema.overtimeLedger)
    .where(eq(schema.overtimeLedger.employeeId, employeeId))
    .orderBy(schema.overtimeLedger.date)
}

export async function getOvertimeSummary(db: Db, employeeId: string, settings: OrgSettings) {
  const entries = await getOvertimeEntries(db, employeeId)
  const balance = computeOvertimeBalance(entries)

  return {
    ...balance,
    daysEquivalent: hoursToDays(balance.availableHours, settings.overtimeHoursPerDay),
    entries,
  }
}

export async function getRequestDaysInYear(
  db: Db,
  employeeId: string,
  leaveTypeId: string,
  year: number,
): Promise<{ approvedDays: number; pendingDays: number }> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const rows = await db
    .select({ days: schema.leaveRequests.days, status: schema.leaveRequests.status })
    .from(schema.leaveRequests)
    .where(
      and(
        eq(schema.leaveRequests.employeeId, employeeId),
        eq(schema.leaveRequests.leaveTypeId, leaveTypeId),
        gte(schema.leaveRequests.startDate, yearStart),
        lte(schema.leaveRequests.startDate, yearEnd),
        inArray(schema.leaveRequests.status, ['approved', 'pending']),
      ),
    )

  return {
    approvedDays: round2(
      rows.filter((row) => row.status === 'approved').reduce((sum, row) => sum + row.days, 0),
    ),
    pendingDays: round2(
      rows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.days, 0),
    ),
  }
}

export interface BalanceForTypeResult extends BalanceResult {
  leaveTypeId: string
  code: string
  source: 'entitlement' | 'overtime'
}

export async function getBalanceForType(
  db: Db,
  input: {
    employee: EmployeeRow
    orgId: string
    leaveType: LeaveTypeRow
    year: number
    settings: OrgSettings
  },
): Promise<BalanceForTypeResult | null> {
  const { employee, orgId, leaveType, year, settings } = input

  if (!leaveType.countsAgainstBalance) return null

  const requestDays = await getRequestDaysInYear(db, employee.id, leaveType.id, year)

  if (leaveType.code === 'COMP') {
    const overtime = await getOvertimeSummary(db, employee.id, settings)
    const entitledDays = overtime.daysEquivalent
    const balance = computeBalance({
      entitledDays,
      approvedDays: requestDays.approvedDays,
      pendingDays: requestDays.pendingDays,
    })
    return { ...balance, leaveTypeId: leaveType.id, code: leaveType.code, source: 'overtime' }
  }

  const row = await getEntitlementRow(db, employee.id, leaveType.id, year)

  let entitledDays = row?.entitledDays ?? 0
  if (!row) {
    const holidays = await getHolidayDates(db, orgId, year)
    entitledDays = computeEntitlement({
      year,
      annualDays: settings.annualVacationDays,
      startDate: employee.startDate,
      endDate: employee.endDate,
      mode: settings.vacationMode,
      holidays,
      workweek: settings.workweek,
      seniority: settings.seniority ? { startDate: employee.startDate, rule: settings.seniority } : null,
    }).totalDays
  }

  const balance = computeBalance({
    entitledDays,
    carriedOverDays: row?.carriedOverDays ?? 0,
    adjustmentDays: row?.adjustmentDays ?? 0,
    approvedDays: requestDays.approvedDays,
    pendingDays: requestDays.pendingDays,
  })

  return { ...balance, leaveTypeId: leaveType.id, code: leaveType.code, source: 'entitlement' }
}

/** Todas las ausencias activas del empleado, opcionalmente excluyendo una solicitud. */
export async function getEmployeeActiveRequests(
  db: Db,
  employeeId: string,
  options?: { excludeRequestId?: string },
) {
  const conditions = [
    eq(schema.leaveRequests.employeeId, employeeId),
    inArray(schema.leaveRequests.status, ['pending', 'approved']),
  ]

  if (options?.excludeRequestId) {
    conditions.push(ne(schema.leaveRequests.id, options.excludeRequestId))
  }

  return db
    .select()
    .from(schema.leaveRequests)
    .where(and(...conditions))
}

/** Ausencias activas de otros empleados del departamento. */
export async function getDepartmentAbsences(
  db: Db,
  departmentId: string,
  employeeId: string,
) {
  return db
    .select({
      startDate: schema.leaveRequests.startDate,
      endDate: schema.leaveRequests.endDate,
    })
    .from(schema.leaveRequests)
    .innerJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id))
    .where(
      and(
        eq(schema.employees.departmentId, departmentId),
        ne(schema.leaveRequests.employeeId, employeeId),
        inArray(schema.leaveRequests.status, ['pending', 'approved']),
      ),
    )
}

export async function getDepartmentSize(db: Db, departmentId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(and(eq(schema.employees.departmentId, departmentId), eq(schema.employees.active, true)))

  return rows.length
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
