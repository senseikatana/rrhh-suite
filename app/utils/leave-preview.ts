import { eachDayOfInterval, format, parseISO } from 'date-fns'

/**
 * Réplica ligera del cálculo del servidor para mostrar los días al instante
 * en el formulario. La validación y el dato definitivo siempre vienen de la API.
 */
export function countPreviewDays(
  start: string,
  end: string,
  mode: 'natural' | 'working',
  holidays: string[],
  workweek: number[],
): number {
  if (!start || !end || end < start) return 0

  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })

  if (mode === 'natural') return days.length

  const holidaySet = new Set(holidays)
  return days.filter((day) => {
    const iso = format(day, 'yyyy-MM-dd')
    return !holidaySet.has(iso) && workweek.includes(day.getDay())
  }).length
}
