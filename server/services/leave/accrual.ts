import { differenceInCalendarDays, getDaysInYear, parseISO } from 'date-fns'
import { countLeaveDays, type LeaveDayOptions } from './working-days'

export interface SeniorityRule {
  /** Cada cuántos años completos se gana el extra. */
  everyYears: number
  /** Días extra por cada tramo cumplido. */
  extraDays: number
  /** Tope de días extra. */
  maxExtraDays?: number
}

export interface EntitlementInput {
  year: number
  annualDays: number
  /** Fecha de alta (ISO). */
  startDate: string
  /** Fecha de baja (ISO, inclusive). Null si sigue activo. */
  endDate?: string | null
  mode: LeaveDayOptions['mode']
  holidays?: readonly string[]
  workweek?: readonly number[]
  seniority?: {
    /** Fecha desde la que cuenta la antigüedad (normalmente el alta). */
    startDate: string
    rule: SeniorityRule
  } | null
}

export interface EntitlementResult {
  /** Derecho bruto del año completo (incluye bonus de antigüedad). */
  fullYearDays: number
  /** Base prorrateada al tiempo trabajado en el año. */
  proratedBaseDays: number
  seniorityBonusDays: number
  /** Total que corresponde al empleado en ese año. */
  totalDays: number
  /** Fracción del año trabajada (0..1). */
  serviceFraction: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function seniorityBonus(
  year: number,
  seniorityStart: string,
  rule: SeniorityRule,
): number {
  if (rule.everyYears <= 0 || rule.extraDays <= 0) return 0

  const start = parseISO(seniorityStart)
  const yearEnd = new Date(year, 11, 31)
  if (start > yearEnd) return 0

  const fullYears = Math.floor(differenceInCalendarDays(yearEnd, start) / 365.25)
  const tiers = Math.floor(fullYears / rule.everyYears)
  const bonus = tiers * rule.extraDays

  return rule.maxExtraDays != null ? Math.min(bonus, rule.maxExtraDays) : bonus
}

/**
 * Calcula el derecho de vacaciones de un año.
 * El prorrateo se hace sobre los días de alta/baja dentro del año natural.
 */
export function computeEntitlement(input: EntitlementInput): EntitlementResult {
  const yearStart = `${input.year}-01-01`
  const yearEnd = `${input.year}-12-31`
  const daysInYear = getDaysInYear(new Date(input.year, 6, 1))

  const effectiveStart = input.startDate > yearStart ? input.startDate : yearStart
  const effectiveEnd = input.endDate && input.endDate < yearEnd ? input.endDate : yearEnd

  if (effectiveEnd < effectiveStart) {
    return {
      fullYearDays: 0,
      proratedBaseDays: 0,
      seniorityBonusDays: 0,
      totalDays: 0,
      serviceFraction: 0,
    }
  }

  const workedDays = differenceInCalendarDays(parseISO(effectiveEnd), parseISO(effectiveStart)) + 1
  const serviceFraction = Math.min(1, workedDays / daysInYear)

  const bonus = input.seniority
    ? seniorityBonus(input.year, input.seniority.startDate, input.seniority.rule)
    : 0

  // El bonus se prorratea igual que la base: quien entra a mitad de año no
  // devenga el tramo completo de antigüedad.
  const proratedBaseDays = round2(input.annualDays * serviceFraction)
  const seniorityBonusDays = round2(bonus * serviceFraction)

  return {
    fullYearDays: round2(input.annualDays + bonus),
    proratedBaseDays,
    seniorityBonusDays,
    totalDays: round2(proratedBaseDays + seniorityBonusDays),
    serviceFraction: round2(serviceFraction * 100) / 100,
  }
}

/**
 * Saldo de días que quedan por disfrutar en un rango concreto.
 * Se usa para el saldo del año y para validar solicitudes con fecha futura.
 */
export function leaveDaysInRange(
  startDate: string,
  endDate: string,
  options: LeaveDayOptions,
): number {
  return countLeaveDays(startDate, endDate, options)
}
