export interface AttendanceClockEvent {
  id: string
  occurredAt: string
  direction: 'in' | 'out'
  corrected?: boolean
  note?: string | null
  source?: string
}

export interface AttendanceStatus {
  clockedIn: boolean
  openSince: string | null
  elapsedMinutes: number
  lastDirection: 'in' | 'out' | null
  lastEventAt: string | null
  workedTodayMinutes: number
  expectedTodayMinutes: number
  balanceTodayMinutes: number
  overtimeTodayMinutes: number
  deficitTodayMinutes: number
  anomalies: string[]
  scheduleStart: string | null
  scheduleEnd: string | null
  firstIn: string | null
  lastOut: string | null
  lateMinutes: number
  earlyLeaveMinutes: number
  eventsToday: AttendanceClockEvent[]
}

export interface AttendanceSession {
  start: string
  end: string | null
  minutes: number
  open: boolean
  startEventId: string
  endEventId: string | null
}

export interface AttendanceDay {
  date: string
  sessions: AttendanceSession[]
  workedMinutes: number
  expectedMinutes: number
  balanceMinutes: number
  overtimeMinutes: number
  deficitMinutes: number
  openSession: boolean
  anomalies: string[]
  firstIn: string | null
  lastOut: string | null
  lateMinutes: number
  earlyLeaveMinutes: number
  scheduleMinutes: number | null
}

export interface AttendanceSummary {
  from: string
  to: string
  days: AttendanceDay[]
  workedMinutes: number
  expectedMinutes: number
  balanceMinutes: number
  overtimeMinutes: number
  deficitMinutes: number
  sessions: number
  openSessions: number
  anomalies: string[]
}

export interface TeamAttendanceRow {
  employeeId: string
  firstName: string
  lastName: string
  departmentId: string | null
  departmentName: string | null
  position: string | null
  clockedIn: boolean
  openSince: string | null
  elapsedMinutes: number
  lastDirection: 'in' | 'out' | null
  lastEventAt: string | null
  workedTodayMinutes: number
  expectedTodayMinutes: number
  balanceTodayMinutes: number
  overtimeTodayMinutes: number
  deficitTodayMinutes: number
  leave: { typeName: string; typeColor: string } | null
  anomalies: string[]
}

export interface TeamAttendanceResponse {
  at: string
  rows: TeamAttendanceRow[]
}
