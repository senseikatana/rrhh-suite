import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function addDaysKey(dateKey: string, days: number): string {
  return format(addDays(parseISO(dateKey), days), 'yyyy-MM-dd')
}

export function startOfWeekKey(dateKey: string): string {
  const date = parseISO(dateKey)
  return format(addDays(date, -((date.getDay() + 6) % 7)), 'yyyy-MM-dd')
}

export function endOfWeekKey(dateKey: string): string {
  return addDaysKey(startOfWeekKey(dateKey), 6)
}

export function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function endOfMonthKey(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number)
  return `${dateKey.slice(0, 7)}-${String(new Date(year!, month!, 0).getDate()).padStart(2, '0')}`
}

export function eachDateKey(from: string, to: string): string[] {
  if (to < from) return []
  return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((date) =>
    format(date, 'yyyy-MM-dd'),
  )
}

export function weekdayLabel(dateKey: string, short = true): string {
  return format(parseISO(dateKey), short ? 'EEE' : 'EEEE', { locale: es })
}

export function dayNumber(dateKey: string): string {
  return format(parseISO(dateKey), 'd')
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return `${hours} h ${String(rest).padStart(2, '0')} min`
}

export function formatSignedMinutes(minutes: number): string {
  if (minutes === 0) return '0 min'
  return `${minutes > 0 ? '+' : '−'}${formatMinutes(Math.abs(minutes))}`
}

export function formatClock(date: Date | null): string {
  if (!date) return '--:--:--'
  return format(date, 'HH:mm:ss')
}

export function formatClockShort(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return format(date, 'HH:mm')
}

export function minutesSince(value: string | Date | null | undefined, now: Date): number {
  if (!value) return 0
  const start = typeof value === 'string' ? new Date(value) : value
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60_000))
}
