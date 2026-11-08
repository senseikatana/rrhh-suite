import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { Db } from '../database/client'
import * as schema from '../database/schema'
import type { OrgSettings } from '../services/settings'
import {
  buildStatus,
  pairClockEvents,
  summarizeRange,
  type ClockEventLike,
  type SummaryOptions,
} from '../services/attendance/sessions'
import {
  addDaysToKey,
  endOfLocalDay,
  localDateKey,
  startOfLocalDay,
} from '../services/attendance/time'

export type AttendanceEmployeeRow = typeof schema.employees.$inferSelect
export type OrganizationRow = typeof schema.organizations.$inferSelect

export function attendanceOptions(
  org: OrganizationRow,
  employee: Pick<AttendanceEmployeeRow, 'weeklyHours' | 'scheduleStart' | 'scheduleEnd'>,
  settings: OrgSettings,
  now: Date,
): SummaryOptions {
  return {
    timeZone: org.timezone,
    workweek: settings.workweek,
    weeklyHours: employee.weeklyHours,
    toleranceMinutes: settings.attendanceToleranceMinutes,
    now,
    scheduleStart: employee.scheduleStart ?? settings.defaultScheduleStart,
    scheduleEnd: employee.scheduleEnd ?? settings.defaultScheduleEnd,
  }
}

export async function getClockEvents(
  db: Db,
  employeeId: string,
  from: Date,
  to: Date,
): Promise<ClockEventLike[]> {
  const rows = await db
    .select({
      id: schema.clockEvents.id,
      occurredAt: schema.clockEvents.occurredAt,
      direction: schema.clockEvents.direction,
      corrected: schema.clockEvents.corrected,
      note: schema.clockEvents.note,
      source: schema.clockEvents.source,
    })
    .from(schema.clockEvents)
    .where(
      and(
        eq(schema.clockEvents.employeeId, employeeId),
        gte(schema.clockEvents.occurredAt, from),
        lte(schema.clockEvents.occurredAt, to),
      ),
    )
    .orderBy(asc(schema.clockEvents.occurredAt))

  return rows
}

export async function getAttendanceStatus(
  db: Db,
  employee: AttendanceEmployeeRow,
  org: OrganizationRow,
  settings: OrgSettings,
  now = new Date(),
) {
  const today = localDateKey(now, org.timezone)
  const from = startOfLocalDay(addDaysToKey(today, -7), org.timezone)
  const events = await getClockEvents(db, employee.id, from, now)
  const todayStart = startOfLocalDay(today, org.timezone)

  return {
    ...buildStatus(events, attendanceOptions(org, employee, settings, now)),
    eventsToday: events.filter((event) => event.occurredAt >= todayStart),
  }
}

export async function getAttendanceSummary(
  db: Db,
  employee: AttendanceEmployeeRow,
  org: OrganizationRow,
  settings: OrgSettings,
  fromKey: string,
  toKey: string,
  now = new Date(),
) {
  const from = startOfLocalDay(addDaysToKey(fromKey, -1), org.timezone)
  const to = endOfLocalDay(addDaysToKey(toKey, 1), org.timezone)
  const events = await getClockEvents(db, employee.id, from, to)
  const paired = pairClockEvents(events, now)

  return summarizeRange(
    fromKey,
    toKey,
    paired.sessions,
    attendanceOptions(org, employee, settings, now),
    paired.orphans,
    paired.anomalies,
  )
}

export async function getEmployeeById(db: Db, orgId: string, employeeId: string) {
  const [employee] = await db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.id, employeeId), eq(schema.employees.orgId, orgId)))
    .limit(1)

  return employee
}

export interface TeamAttendanceRow {
  employeeId: string
  firstName: string
  lastName: string
  departmentId: string | null
  departmentName: string | null
  position: string | null
  clockedIn: boolean
  openSince: Date | null
  elapsedMinutes: number
  lastDirection: 'in' | 'out' | null
  lastEventAt: Date | null
  workedTodayMinutes: number
  expectedTodayMinutes: number
  balanceTodayMinutes: number
  overtimeTodayMinutes: number
  deficitTodayMinutes: number
  leave: { typeName: string; typeColor: string } | null
  anomalies: string[]
}

export async function getTeamAttendance(
  db: Db,
  org: OrganizationRow,
  settings: OrgSettings,
  now = new Date(),
): Promise<TeamAttendanceRow[]> {
  const today = localDateKey(now, org.timezone)
  const from = startOfLocalDay(addDaysToKey(today, -1), org.timezone)

  const employees = await db
    .select({
      id: schema.employees.id,
      firstName: schema.employees.firstName,
      lastName: schema.employees.lastName,
      departmentId: schema.employees.departmentId,
      departmentName: schema.departments.name,
      position: schema.employees.position,
      weeklyHours: schema.employees.weeklyHours,
      scheduleStart: schema.employees.scheduleStart,
      scheduleEnd: schema.employees.scheduleEnd,
    })
    .from(schema.employees)
    .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
    .where(and(eq(schema.employees.orgId, org.id), eq(schema.employees.active, true)))

  const events = await db
    .select({
      employeeId: schema.clockEvents.employeeId,
      id: schema.clockEvents.id,
      occurredAt: schema.clockEvents.occurredAt,
      direction: schema.clockEvents.direction,
      corrected: schema.clockEvents.corrected,
      note: schema.clockEvents.note,
      source: schema.clockEvents.source,
    })
    .from(schema.clockEvents)
    .where(
      and(
        eq(schema.clockEvents.orgId, org.id),
        gte(schema.clockEvents.occurredAt, from),
        lte(schema.clockEvents.occurredAt, now),
      ),
    )
    .orderBy(asc(schema.clockEvents.occurredAt))

  const leaves = await db
    .select({
      employeeId: schema.leaveRequests.employeeId,
      typeName: schema.leaveTypes.name,
      typeColor: schema.leaveTypes.color,
    })
    .from(schema.leaveRequests)
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .where(
      and(
        eq(schema.leaveRequests.orgId, org.id),
        eq(schema.leaveRequests.status, 'approved'),
        lte(schema.leaveRequests.startDate, today),
        gte(schema.leaveRequests.endDate, today),
      ),
    )

  return employees
    .map((employee) => {
      const ownEvents = events
        .filter((event) => event.employeeId === employee.id)
        .map((event) => ({
          id: event.id,
          occurredAt: event.occurredAt,
          direction: event.direction,
          corrected: event.corrected,
          note: event.note,
          source: event.source,
        }))

      const status = buildStatus(
        ownEvents,
        attendanceOptions(org, employee, settings, now),
      )
      const leave = leaves.find((item) => item.employeeId === employee.id)

      return {
        employeeId: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        position: employee.position,
        clockedIn: status.clockedIn,
        openSince: status.openSince,
        elapsedMinutes: status.elapsedMinutes,
        lastDirection: status.lastDirection,
        lastEventAt: status.lastEventAt,
        workedTodayMinutes: status.workedTodayMinutes,
        expectedTodayMinutes: status.expectedTodayMinutes,
        balanceTodayMinutes: status.balanceTodayMinutes,
        overtimeTodayMinutes: status.overtimeTodayMinutes,
        deficitTodayMinutes: status.deficitTodayMinutes,
        leave: leave ? { typeName: leave.typeName, typeColor: leave.typeColor } : null,
        anomalies: status.anomalies,
      }
    })
    .sort((a, b) => {
      if (a.clockedIn !== b.clockedIn) return a.clockedIn ? -1 : 1
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es')
    })
}
