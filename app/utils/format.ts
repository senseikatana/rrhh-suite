import { addDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, "d 'de' MMM yyyy", { locale: es })
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'd MMM', { locale: es })
}

export function formatMonth(monthIndex: number): string {
  return format(new Date(2024, monthIndex, 1), 'MMMM', { locale: es })
}

export function formatMonthShort(monthIndex: number): string {
  return format(new Date(2024, monthIndex, 1), 'MMM', { locale: es })
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoPlus(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

export function humanRange(start: string, end: string): string {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} → ${formatDate(end)}`
}
