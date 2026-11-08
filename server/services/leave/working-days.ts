import { eachDayOfInterval, format, parseISO } from 'date-fns'

export type VacationMode = 'natural' | 'working'

export interface LeaveDayOptions {
  mode: VacationMode
  /** Festivos en formato YYYY-MM-DD. */
  holidays?: readonly string[]
  /** Días de la semana que se trabajan (0 = domingo … 6 = sábado). */
  workweek?: readonly number[]
}

export const DEFAULT_WORKWEEK = [1, 2, 3, 4, 5] as const

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseIsoDate(value: string): Date {
  return parseISO(value)
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = parseISO(value)
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value
}

/** Lista inclusiva de fechas ISO entre dos extremos. Devuelve [] si el rango está invertido. */
export function eachIsoDate(start: string, end: string): string[] {
  if (!isValidIsoDate(start) || !isValidIsoDate(end) || end < start) return []
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map(toIsoDate)
}

/**
 * Cuenta los días de ausencia de un rango.
 * - `natural`: todos los días del calendario.
 * - `working`: excluye fines de semana no laborables y festivos.
 */
export function countLeaveDays(start: string, end: string, options: LeaveDayOptions): number {
  const dates = eachIsoDate(start, end)
  if (options.mode === 'natural') return dates.length

  const holidays = new Set(options.holidays ?? [])
  const workweek = new Set(options.workweek ?? DEFAULT_WORKWEEK)

  return dates.filter((date) => {
    if (holidays.has(date)) return false
    return workweek.has(parseISO(date).getDay())
  }).length
}

/** Días de solape inclusivo entre dos rangos. */
export function countOverlapDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  return eachIsoDate(start, end).length
}

/**
 * Número máximo de ausencias simultáneas que produce un rango candidato
 * sumado a las ausencias ya existentes.
 */
export function maxConcurrentAbsences(
  candidate: { startDate: string; endDate: string },
  existing: ReadonlyArray<{ startDate: string; endDate: string }>,
): number {
  const perDay = new Map<string, number>()

  for (const range of [candidate, ...existing]) {
    for (const date of eachIsoDate(range.startDate, range.endDate)) {
      perDay.set(date, (perDay.get(date) ?? 0) + 1)
    }
  }

  return perDay.size === 0 ? 0 : Math.max(...perDay.values())
}
