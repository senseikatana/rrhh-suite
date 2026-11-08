export interface LeaveType {
  id: string
  code: string
  name: string
  color: string
  paid: boolean
  requiresApproval: boolean
  countsAgainstBalance: boolean
  unit: 'days' | 'hours'
  active: boolean
}

export interface LeaveBalance {
  leaveTypeId: string
  code: string
  source: 'entitlement' | 'overtime'
  totalDays: number
  usedDays: number
  reservedDays: number
  availableDays: number
}

export interface OvertimeSummary {
  accruedHours: number
  usedHours: number
  adjustmentHours: number
  availableHours: number
  daysEquivalent: number
  entries: Array<{
    id: string
    date: string
    hours: number
    type: 'accrued' | 'used' | 'adjustment'
    note: string | null
  }>
}

export interface BalanceResponse {
  year: number
  employee: {
    id: string
    firstName: string
    lastName: string
    departmentId: string | null
    startDate: string
  } | null
  balances: LeaveBalance[]
  overtime: OvertimeSummary | null
  types: LeaveType[]
}

export interface LeaveRequestRow {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  departmentId: string | null
  departmentName: string | null
  leaveTypeId: string
  typeName: string
  typeColor: string
  typeCode: string
  startDate: string
  endDate: string
  days: number
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason: string | null
  decisionNote?: string | null
  decidedAt?: string | null
  createdAt?: string
}

export interface CalendarEvent {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  departmentId: string | null
  departmentName: string | null
  leaveTypeId: string
  typeName: string
  typeColor: string
  typeCode: string
  startDate: string
  endDate: string
  days: number
  status: 'pending' | 'approved'
}

export interface CalendarResponse {
  year: number
  scope: string
  canSeeAll: boolean
  events: CalendarEvent[]
}

export interface EmployeeRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  pin: string | null
  position: string | null
  startDate: string
  endDate: string | null
  weeklyHours: number
  active: boolean
  departmentId: string | null
  departmentName: string | null
  departmentColor: string | null
  userId: string | null
  role: 'admin' | 'manager' | 'employee' | null
}

export interface DepartmentRow {
  id: string
  name: string
  color: string
  minCoverage: number
  headcount: number
}

export interface ImportResult {
  created: number
  updated: number
  holidays: number
  departmentsCreated: number
  errors: string[]
}
