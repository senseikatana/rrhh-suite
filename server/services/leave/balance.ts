export interface BalanceInput {
  entitledDays: number
  carriedOverDays?: number
  adjustmentDays?: number
  /** Días de solicitudes aprobadas. */
  approvedDays: number
  /** Días de solicitudes pendientes (reservados, aún no disfrutados). */
  pendingDays: number
}

export interface BalanceResult {
  /** Derecho total del año (derecho + arrastre + ajustes). */
  totalDays: number
  /** Días ya disfrutados (aprobados). */
  usedDays: number
  /** Días reservados por solicitudes pendientes. */
  reservedDays: number
  /** Días disponibles para nuevas solicitudes. */
  availableDays: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeBalance(input: BalanceInput): BalanceResult {
  const totalDays = round2(
    input.entitledDays + (input.carriedOverDays ?? 0) + (input.adjustmentDays ?? 0),
  )
  const usedDays = round2(input.approvedDays)
  const reservedDays = round2(input.pendingDays)

  return {
    totalDays,
    usedDays,
    reservedDays,
    availableDays: round2(totalDays - usedDays - reservedDays),
  }
}

/** Saldo de la bolsa de horas, en horas. */
export function computeOvertimeBalance(entries: ReadonlyArray<{ hours: number; type: 'accrued' | 'used' | 'adjustment' }>) {
  const accrued = entries.filter((e) => e.type === 'accrued').reduce((sum, e) => sum + e.hours, 0)
  const used = entries.filter((e) => e.type === 'used').reduce((sum, e) => sum + e.hours, 0)
  const adjustment = entries.filter((e) => e.type === 'adjustment').reduce((sum, e) => sum + e.hours, 0)

  return {
    accruedHours: round2(accrued),
    usedHours: round2(used),
    adjustmentHours: round2(adjustment),
    availableHours: round2(accrued - used + adjustment),
  }
}

/** Convierte horas de bolsa en días de descanso. */
export function hoursToDays(hours: number, hoursPerDay: number): number {
  if (hoursPerDay <= 0) return 0
  return round2(hours / hoursPerDay)
}
