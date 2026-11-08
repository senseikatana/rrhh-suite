import { minutesBetween, localDateKey, scheduleWindow, weekdayOfKey } from './time'

export type ClockDirection = 'in' | 'out'

export interface ClockEventLike {
  id: string
  occurredAt: Date
  direction: ClockDirection
  corrected?: boolean
  note?: string | null
  source?: string
}

export interface WorkSession {
  start: Date
  end: Date | null
  minutes: number
  open: boolean
  startEventId: string
  endEventId: string | null
}

export interface PairResult {
  sessions: WorkSession[]
  /** Salidas sin entrada previa. */
  orphans: ClockEventLike[]
  anomalies: string[]
}

/**
 * Empareja fichajes en orden cronológico. Una entrada sin salida queda abierta;
 * si llega otra entrada sin haberse cerrado, la anterior se cierra con la nueva
 * y se registra una incidencia (para no perder horas ni inflarlas).
 */
export function pairClockEvents(events: readonly ClockEventLike[], now = new Date()): PairResult {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
  const sessions: WorkSession[] = []
  const orphans: ClockEventLike[] = []
  const anomalies: string[] = []

  let open: ClockEventLike | null = null

  for (const event of sorted) {
    if (event.direction === 'in') {
      if (open) {
        anomalies.push(
          `Entrada sin salida el ${open.occurredAt.toISOString()}: se cierra al fichar de nuevo.`,
        )
        sessions.push({
          start: open.occurredAt,
          end: event.occurredAt,
          minutes: minutesBetween(open.occurredAt, event.occurredAt),
          open: false,
          startEventId: open.id,
          endEventId: event.id,
        })
      }
      open = event
      continue
    }

    if (!open) {
      orphans.push(event)
      continue
    }

    sessions.push({
      start: open.occurredAt,
      end: event.occurredAt,
      minutes: Math.max(0, minutesBetween(open.occurredAt, event.occurredAt)),
      open: false,
      startEventId: open.id,
      endEventId: event.id,
    })
    open = null
  }

  if (open) {
    sessions.push({
      start: open.occurredAt,
      end: null,
      minutes: Math.max(0, minutesBetween(open.occurredAt, now)),
      open: true,
      startEventId: open.id,
      endEventId: null,
    })
  }

  return { sessions, orphans, anomalies }
}

export interface SummaryOptions {
  timeZone: string
  /** 0 = domingo … 6 = sábado. */
  workweek: readonly number[]
  /** Jornada semanal del empleado en horas (respaldo si no hay horario). */
  weeklyHours: number
  toleranceMinutes: number
  now: Date
  /** Horario contractual en HH:mm. Si falta, se usa la jornada semanal. */
  scheduleStart?: string | null
  scheduleEnd?: string | null
}

export interface DaySummary {
  date: string
  sessions: WorkSession[]
  workedMinutes: number
  expectedMinutes: number
  balanceMinutes: number
  overtimeMinutes: number
  deficitMinutes: number
  openSession: boolean
  anomalies: string[]
  /** Primera entrada y última salida del día. */
  firstIn: Date | null
  lastOut: Date | null
  /** Minutos de retraso sobre el horario contractual. */
  lateMinutes: number
  /** Minutos de salida anticipada respecto al horario contractual. */
  earlyLeaveMinutes: number
  /** Duración del horario contractual, si está definido. */
  scheduleMinutes: number | null
}

export interface RangeSummary {
  from: string
  to: string
  days: DaySummary[]
  workedMinutes: number
  expectedMinutes: number
  balanceMinutes: number
  overtimeMinutes: number
  deficitMinutes: number
  sessions: number
  openSessions: number
  anomalies: string[]
}

export function dailyExpectedMinutes(
  settings: Pick<SummaryOptions, 'workweek' | 'weeklyHours'>,
): number {
  if (settings.workweek.length === 0) return 0
  return Math.round((settings.weeklyHours * 60) / settings.workweek.length)
}

function emptyDay(date: string): DaySummary {
  return {
    date,
    sessions: [],
    workedMinutes: 0,
    expectedMinutes: 0,
    balanceMinutes: 0,
    overtimeMinutes: 0,
    deficitMinutes: 0,
    openSession: false,
    anomalies: [],
    firstIn: null,
    lastOut: null,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    scheduleMinutes: null,
  }
}

/**
 * Resumen de un día. Las sesiones se imputan al día en que empiezan, de modo
 * que un turno de noche completo cuenta en su fecha de entrada.
 */
export function summarizeDay(
  dateKey: string,
  sessions: readonly WorkSession[],
  options: SummaryOptions,
): DaySummary {
  const isToday = localDateKey(options.now, options.timeZone) === dateKey
  const daySessions = sessions.filter(
    (session) => localDateKey(session.start, options.timeZone) === dateKey,
  )

  const isWorkday = options.workweek.includes(weekdayOfKey(dateKey))
  const window = isWorkday
    ? scheduleWindow(dateKey, options.scheduleStart, options.scheduleEnd, options.timeZone)
    : null

  // Solo se exige jornada en los días en los que la persona ha fichado.
  // Así las vacaciones, bajas o descansos no generan un déficit ficticio.
  const expectedMinutes =
    daySessions.length > 0 && isWorkday
      ? (window?.minutes ?? dailyExpectedMinutes(options))
      : 0

  const anomalies: string[] = []
  let workedMinutes = 0
  let openSession = false

  for (const session of daySessions) {
    if (session.open) {
      openSession = true
      if (isToday) {
        workedMinutes += session.minutes
      } else {
        anomalies.push(
          `Sesión sin salida el ${dateKey}: no se contabiliza hasta corregirla o cerrarla.`,
        )
      }
      continue
    }
    workedMinutes += session.minutes
  }

  const rawBalance = workedMinutes - expectedMinutes
  const balanceMinutes = Math.abs(rawBalance) <= options.toleranceMinutes ? 0 : rawBalance

  const firstIn = daySessions.length
    ? new Date(Math.min(...daySessions.map((session) => session.start.getTime())))
    : null

  const outCandidates = daySessions
    .map((session) => session.end ?? (isToday ? options.now : null))
    .filter((date): date is Date => Boolean(date))

  const lastOut = outCandidates.length
    ? new Date(Math.max(...outCandidates.map((date) => date.getTime())))
    : null

  const lateMinutes =
    window && firstIn ? Math.max(0, minutesBetween(window.startAt, firstIn)) : 0
  const earlyLeaveMinutes =
    window && lastOut ? Math.max(0, minutesBetween(lastOut, window.endAt)) : 0

  return {
    date: dateKey,
    sessions: daySessions,
    workedMinutes,
    expectedMinutes,
    balanceMinutes,
    overtimeMinutes: Math.max(0, balanceMinutes),
    deficitMinutes: Math.max(0, -balanceMinutes),
    openSession,
    anomalies,
    firstIn,
    lastOut,
    lateMinutes,
    earlyLeaveMinutes,
    scheduleMinutes: window?.minutes ?? null,
  }
}

export function summarizeRange(
  from: string,
  to: string,
  sessions: readonly WorkSession[],
  options: SummaryOptions,
  orphans: readonly ClockEventLike[] = [],
  pairingAnomalies: readonly string[] = [],
): RangeSummary {
  const days: DaySummary[] = []
  let cursor = from

  while (cursor <= to) {
    const day = summarizeDay(cursor, sessions, options)

    for (const orphan of orphans) {
      if (localDateKey(orphan.occurredAt, options.timeZone) === cursor) {
        day.anomalies.push(`Salida sin entrada a las ${orphan.occurredAt.toISOString()}.`)
      }
    }

    days.push(day)
    cursor = nextDateKey(cursor)
  }

  const totals = days.reduce(
    (accumulator, day) => {
      accumulator.workedMinutes += day.workedMinutes
      accumulator.expectedMinutes += day.expectedMinutes
      accumulator.balanceMinutes += day.balanceMinutes
      accumulator.overtimeMinutes += day.overtimeMinutes
      accumulator.deficitMinutes += day.deficitMinutes
      accumulator.sessions += day.sessions.length
      if (day.openSession) accumulator.openSessions += 1
      return accumulator
    },
    {
      workedMinutes: 0,
      expectedMinutes: 0,
      balanceMinutes: 0,
      overtimeMinutes: 0,
      deficitMinutes: 0,
      sessions: 0,
      openSessions: 0,
    },
  )

  return {
    from,
    to,
    days,
    ...totals,
    anomalies: [...pairingAnomalies, ...days.flatMap((day) => day.anomalies)],
  }
}

export interface AttendanceStatus {
  clockedIn: boolean
  openSince: Date | null
  elapsedMinutes: number
  lastDirection: ClockDirection | null
  lastEventAt: Date | null
  workedTodayMinutes: number
  expectedTodayMinutes: number
  balanceTodayMinutes: number
  overtimeTodayMinutes: number
  deficitTodayMinutes: number
  anomalies: string[]
  scheduleStart: string | null
  scheduleEnd: string | null
  firstIn: Date | null
  lastOut: Date | null
  lateMinutes: number
  earlyLeaveMinutes: number
}

export function buildStatus(
  events: readonly ClockEventLike[],
  options: SummaryOptions,
): AttendanceStatus {
  const paired = pairClockEvents(events, options.now)
  const today = localDateKey(options.now, options.timeZone)
  const openSession = [...paired.sessions].reverse().find((session) => session.open) ?? null
  const day = summarizeDay(today, paired.sessions, options)

  const lastEvent = [...events].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  )[0]

  // Antes de fichar ya se puede mostrar la jornada objetivo del día.
  const isWorkday = options.workweek.includes(weekdayOfKey(today))
  const expectedToday =
    day.expectedMinutes > 0
      ? day.expectedMinutes
      : isWorkday
        ? (day.scheduleMinutes ?? dailyExpectedMinutes(options))
        : 0

  return {
    clockedIn: Boolean(openSession),
    openSince: openSession?.start ?? null,
    elapsedMinutes: openSession?.minutes ?? 0,
    lastDirection: lastEvent?.direction ?? null,
    lastEventAt: lastEvent?.occurredAt ?? null,
    workedTodayMinutes: day.workedMinutes,
    expectedTodayMinutes: expectedToday,
    balanceTodayMinutes: day.balanceMinutes,
    overtimeTodayMinutes: day.overtimeMinutes,
    deficitTodayMinutes: day.deficitMinutes,
    anomalies: day.anomalies,
    scheduleStart: options.scheduleStart ?? null,
    scheduleEnd: options.scheduleEnd ?? null,
    firstIn: day.firstIn,
    lastOut: day.lastOut,
    lateMinutes: day.lateMinutes,
    earlyLeaveMinutes: day.earlyLeaveMinutes,
  }
}

function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year!, month! - 1, day! + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export { emptyDay }
