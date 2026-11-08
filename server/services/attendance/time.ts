import { addDays, eachDayOfInterval, format, parseISO, subDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}

/** Ventana contractual de un día. Si la salida es anterior a la entrada, cruza medianoche. */
export function scheduleWindow(
  dateKey: string,
  start: string | null | undefined,
  end: string | null | undefined,
  timeZone: string,
): { startAt: Date; endAt: Date; minutes: number } | null {
  if (!start || !end || !isValidTime(start) || !isValidTime(end)) return null

  const startAt = zonedDateTime(dateKey, start, timeZone)
  let endAt = zonedDateTime(dateKey, end, timeZone)

  if (endAt.getTime() <= startAt.getTime()) {
    endAt = addDays(endAt, 1)
  }

  const minutes = minutesBetween(startAt, endAt)
  if (minutes <= 0 || minutes > 16 * 60) return null

  return { startAt, endAt, minutes }
}

export function localDateKey(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
}

export function localTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'HH:mm')
}

export function localDateTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd HH:mm:ss')
}

/** Construye un instante UTC a partir de una fecha y hora locales. */
export function zonedDateTime(dateKey: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${dateKey} ${time}:00`, timeZone)
}

export function startOfLocalDay(dateKey: string, timeZone: string): Date {
  return fromZonedTime(`${dateKey} 00:00:00`, timeZone)
}

export function endOfLocalDay(dateKey: string, timeZone: string): Date {
  return addDays(startOfLocalDay(dateKey, timeZone), 1)
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000)
}

export function weekdayOfKey(dateKey: string): number {
  return parseISO(dateKey).getDay()
}

export function addDaysToKey(dateKey: string, days: number): string {
  return format(addDays(parseISO(dateKey), days), 'yyyy-MM-dd')
}

export function eachDateKey(from: string, to: string): string[] {
  if (to < from) return []
  return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((date) =>
    format(date, 'yyyy-MM-dd'),
  )
}

/** Lunes de la semana a la que pertenece la fecha. */
export function startOfWeekKey(dateKey: string): string {
  const date = parseISO(dateKey)
  const offset = (date.getDay() + 6) % 7
  return format(subDays(date, offset), 'yyyy-MM-dd')
}

export function endOfWeekKey(dateKey: string): string {
  return addDaysToKey(startOfWeekKey(dateKey), 6)
}

export function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function endOfMonthKey(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number)
  const lastDay = new Date(year!, month!, 0).getDate()
  return `${dateKey.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return `${hours} h ${String(rest).padStart(2, '0')} min`
}

export function formatSignedDuration(minutes: number): string {
  if (minutes === 0) return '0 min'
  return `${minutes > 0 ? '+' : '−'}${formatDuration(Math.abs(minutes))}`
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}
