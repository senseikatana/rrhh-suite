import { describe, expect, it } from 'vitest'
import {
  buildStatus,
  pairClockEvents,
  summarizeDay,
  summarizeRange,
  type ClockEventLike,
  type SummaryOptions,
} from '../../server/services/attendance/sessions'
import {
  formatDuration,
  formatSignedDuration,
  localDateKey,
  minutesBetween,
  startOfWeekKey,
  zonedDateTime,
} from '../../server/services/attendance/time'

const TZ = 'Europe/Madrid'

function event(
  id: string,
  dateKey: string,
  time: string,
  direction: 'in' | 'out',
): ClockEventLike {
  return { id, occurredAt: zonedDateTime(dateKey, time, TZ), direction }
}

const options: SummaryOptions = {
  timeZone: TZ,
  workweek: [1, 2, 3, 4, 5],
  weeklyHours: 40,
  toleranceMinutes: 5,
  now: zonedDateTime('2026-11-09', '18:00', TZ),
}

describe('time helpers', () => {
  it('convierte hora local a UTC con horario de invierno', () => {
    const date = zonedDateTime('2026-11-09', '08:00', TZ)
    expect(date.toISOString()).toBe('2026-11-09T07:00:00.000Z')
  })

  it('convierte hora local a UTC con horario de verano', () => {
    const date = zonedDateTime('2026-07-01', '08:00', TZ)
    expect(date.toISOString()).toBe('2026-07-01T06:00:00.000Z')
  })

  it('calcula el lunes de la semana', () => {
    expect(startOfWeekKey('2026-11-09')).toBe('2026-11-09')
    expect(startOfWeekKey('2026-11-15')).toBe('2026-11-09')
    expect(startOfWeekKey('2026-11-08')).toBe('2026-11-02')
  })

  it('formatea duraciones', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(65)).toBe('1 h 05 min')
    expect(formatDuration(480)).toBe('8 h 00 min')
    expect(formatSignedDuration(90)).toBe('+1 h 30 min')
    expect(formatSignedDuration(-30)).toBe('−30 min')
  })
})

describe('pairClockEvents', () => {
  it('empareja una jornada simple', () => {
    const result = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '16:00', 'out'),
    ])

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]!.minutes).toBe(480)
    expect(result.sessions[0]!.open).toBe(false)
    expect(result.orphans).toEqual([])
  })

  it('suma turnos partidos', () => {
    const result = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '12:00', 'out'),
      event('c', '2026-11-09', '17:00', 'in'),
      event('d', '2026-11-09', '20:00', 'out'),
    ])

    expect(result.sessions).toHaveLength(2)
    expect(result.sessions.reduce((sum, session) => sum + session.minutes, 0)).toBe(420)
  })

  it('mantiene abierta la entrada sin salida', () => {
    const now = zonedDateTime('2026-11-09', '12:00', TZ)
    const result = pairClockEvents([event('a', '2026-11-09', '08:00', 'in')], now)

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]!.open).toBe(true)
    expect(result.sessions[0]!.minutes).toBe(240)
  })

  it('detecta salidas sin entrada', () => {
    const result = pairClockEvents([event('a', '2026-11-09', '16:00', 'out')])
    expect(result.sessions).toEqual([])
    expect(result.orphans).toHaveLength(1)
  })

  it('cierra una entrada duplicada con incidencia', () => {
    const result = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '12:00', 'in'),
      event('c', '2026-11-09', '16:00', 'out'),
    ])

    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0]!.minutes).toBe(240)
    expect(result.sessions[1]!.minutes).toBe(240)
    expect(result.anomalies).toHaveLength(1)
  })

  it('imputa el turno de noche al día de entrada', () => {
    const result = pairClockEvents([
      event('a', '2026-11-09', '22:00', 'in'),
      event('b', '2026-11-10', '06:00', 'out'),
    ])

    expect(result.sessions[0]!.minutes).toBe(480)
    expect(localDateKey(result.sessions[0]!.start, TZ)).toBe('2026-11-09')
  })
})

describe('summarizeDay', () => {
  it('calcula el balance con tolerancia', () => {
    // 8h 05 min trabajadas: dentro de la tolerancia de 5 minutos.
    const sessions = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '16:05', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-09', sessions, options)
    expect(day.workedMinutes).toBe(485)
    expect(day.expectedMinutes).toBe(480)
    expect(day.balanceMinutes).toBe(0)
    expect(day.overtimeMinutes).toBe(0)
  })

  it('acumula exceso por encima de la tolerancia', () => {
    const sessions = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '16:20', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-09', sessions, options)
    expect(day.balanceMinutes).toBe(20)
    expect(day.overtimeMinutes).toBe(20)
  })

  it('acumula defecto por debajo de la tolerancia', () => {
    const sessions = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '15:50', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-09', sessions, options)
    expect(day.balanceMinutes).toBe(-10)
    expect(day.deficitMinutes).toBe(10)
  })

  it('considera todo el tiempo extra en un día no laborable', () => {
    // Sábado 2026-11-14.
    const sessions = pairClockEvents([
      event('a', '2026-11-14', '09:00', 'in'),
      event('b', '2026-11-14', '11:00', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-14', sessions, options)
    expect(day.expectedMinutes).toBe(0)
    expect(day.overtimeMinutes).toBe(120)
  })

  it('no genera déficit en un día laborable sin fichajes', () => {
    const day = summarizeDay('2026-11-12', [], options)
    expect(day.workedMinutes).toBe(0)
    expect(day.expectedMinutes).toBe(0)
    expect(day.balanceMinutes).toBe(0)
    expect(day.deficitMinutes).toBe(0)
  })

  it('no contabiliza una sesión abierta de un día pasado', () => {
    const historicalOptions = {
      ...options,
      now: zonedDateTime('2026-11-11', '10:00', TZ),
    }
    const sessions = pairClockEvents(
      [event('a', '2026-11-09', '08:00', 'in')],
      historicalOptions.now,
    ).sessions

    const day = summarizeDay('2026-11-09', sessions, historicalOptions)
    expect(day.workedMinutes).toBe(0)
    expect(day.openSession).toBe(true)
    expect(day.anomalies).toHaveLength(1)
  })
})

describe('summarizeRange', () => {
  it('agrega días y totales', () => {
    const paired = pairClockEvents([
      event('a', '2026-11-09', '08:00', 'in'),
      event('b', '2026-11-09', '17:00', 'out'),
      event('c', '2026-11-10', '08:00', 'in'),
      event('d', '2026-11-10', '16:00', 'out'),
    ])

    const summary = summarizeRange('2026-11-09', '2026-11-10', paired.sessions, {
      ...options,
      now: zonedDateTime('2026-11-10', '18:00', TZ),
    })

    expect(summary.days).toHaveLength(2)
    expect(summary.workedMinutes).toBe(540 + 480)
    expect(summary.expectedMinutes).toBe(960)
    expect(summary.overtimeMinutes).toBe(60)
    expect(summary.sessions).toBe(2)
  })
})

describe('buildStatus', () => {
  it('indica que el empleado está dentro', () => {
    const status = buildStatus(
      [
        event('a', '2026-11-09', '08:00', 'in'),
        event('b', '2026-11-08', '16:00', 'out'),
      ],
      options,
    )

    expect(status.clockedIn).toBe(true)
    expect(status.openSince).not.toBeNull()
    expect(status.elapsedMinutes).toBe(600)
    expect(status.workedTodayMinutes).toBe(600)
    expect(status.overtimeTodayMinutes).toBe(120)
  })

  it('indica que el empleado está fuera tras fichar la salida', () => {
    const status = buildStatus(
      [
        event('a', '2026-11-09', '08:00', 'in'),
        event('b', '2026-11-09', '16:00', 'out'),
      ],
      options,
    )

    expect(status.clockedIn).toBe(false)
    expect(status.workedTodayMinutes).toBe(480)
    expect(status.balanceTodayMinutes).toBe(0)
    expect(status.lastDirection).toBe('out')
  })

  it('calcula el tiempo transcurrido desde una entrada de ayer', () => {
    const status = buildStatus([event('a', '2026-11-08', '22:00', 'in')], options)
    expect(status.clockedIn).toBe(true)
    expect(status.openSince).not.toBeNull()
    expect(minutesBetween(status.openSince!, options.now)).toBeGreaterThan(0)
  })
})

describe('horario contractual', () => {
  const scheduled = {
    ...options,
    scheduleStart: '07:20',
    scheduleEnd: '14:50',
  }

  it('usa la duración del contrato en lugar de la jornada semanal', () => {
    // Entrada real 07:30 y salida 14:30: 10 min tarde y 20 min antes.
    const sessions = pairClockEvents([
      event('a', '2026-11-09', '07:30', 'in'),
      event('b', '2026-11-09', '14:30', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-09', sessions, scheduled)

    expect(day.scheduleMinutes).toBe(450)
    expect(day.expectedMinutes).toBe(450)
    expect(day.workedMinutes).toBe(420)
    expect(day.balanceMinutes).toBe(-30)
    expect(day.deficitMinutes).toBe(30)
    expect(day.lateMinutes).toBe(10)
    expect(day.earlyLeaveMinutes).toBe(20)
  })

  it('no marca retraso ni salida anticipada si se cumple el horario', () => {
    const sessions = pairClockEvents([
      event('a', '2026-11-09', '07:10', 'in'),
      event('b', '2026-11-09', '14:55', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-09', sessions, scheduled)

    expect(day.lateMinutes).toBe(0)
    expect(day.earlyLeaveMinutes).toBe(0)
    expect(day.balanceMinutes).toBe(15)
    expect(day.overtimeMinutes).toBe(15)
  })

  it('soporta horarios nocturnos que cruzan medianoche', () => {
    const overnight = {
      ...options,
      scheduleStart: '22:00',
      scheduleEnd: '06:00',
    }

    const sessions = pairClockEvents([
      event('a', '2026-11-09', '22:00', 'in'),
      event('b', '2026-11-10', '06:00', 'out'),
    ]).sessions

    const day = summarizeDay('2026-11-09', sessions, overnight)

    expect(day.scheduleMinutes).toBe(480)
    expect(day.expectedMinutes).toBe(480)
    expect(day.balanceMinutes).toBe(0)
  })

  it('expone el horario y el retraso en el estado en vivo', () => {
    const status = buildStatus(
      [event('a', '2026-11-09', '07:30', 'in')],
      { ...scheduled, now: zonedDateTime('2026-11-09', '09:00', TZ) },
    )

    expect(status.scheduleStart).toBe('07:20')
    expect(status.scheduleEnd).toBe('14:50')
    expect(status.firstIn).not.toBeNull()
    expect(status.lateMinutes).toBe(10)
  })
})
