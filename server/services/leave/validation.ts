export interface DateRange {
  startDate: string
  endDate: string
}

/** Dos rangos ISO se solapan si comparten al menos un día. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export function findOverlaps(
  candidate: DateRange,
  existing: ReadonlyArray<DateRange>,
): DateRange[] {
  return existing.filter((range) => rangesOverlap(candidate, range))
}

export interface RequestValidationInput {
  startDate: string
  endDate: string
  requestedDays: number
  availableDays: number
  today: string
  minNoticeDays: number
  /** Solicitudes propias que se solapan con la nueva. */
  overlaps: ReadonlyArray<DateRange>
  /** Cobertura del departamento. Null si no aplica. */
  coverage?: {
    departmentSize: number
    minCoverage: number
    maxConcurrentAbsences: number
  } | null
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

function daysBetween(a: string, b: string): number {
  const start = Date.parse(`${a}T00:00:00Z`)
  const end = Date.parse(`${b}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000)
}

export function validateLeaveRequest(input: RequestValidationInput): ValidationResult {
  const errors: string[] = []

  if (input.endDate < input.startDate) {
    errors.push('La fecha de fin no puede ser anterior a la de inicio.')
  }

  if (input.requestedDays <= 0) {
    errors.push('El rango seleccionado no contiene días laborables disponibles.')
  }

  if (input.requestedDays > input.availableDays) {
    errors.push(
      `Saldo insuficiente: se piden ${input.requestedDays} días y quedan ${input.availableDays}.`,
    )
  }

  if (input.overlaps.length > 0) {
    errors.push('Ya existe una solicitud que se solapa con estas fechas.')
  }

  const notice = daysBetween(input.today, input.startDate)
  if (notice < input.minNoticeDays) {
    errors.push(
      `La solicitud necesita al menos ${input.minNoticeDays} días de antelación (faltan ${Math.max(notice, 0)}).`,
    )
  }

  if (input.coverage) {
    const { departmentSize, minCoverage, maxConcurrentAbsences } = input.coverage
    const remaining = departmentSize - maxConcurrentAbsences
    if (departmentSize > 0 && remaining < minCoverage) {
      errors.push(
        `Cobertura insuficiente en el departamento: quedarían ${Math.max(remaining, 0)} personas y el mínimo es ${minCoverage}.`,
      )
    }
  }

  return { ok: errors.length === 0, errors }
}
