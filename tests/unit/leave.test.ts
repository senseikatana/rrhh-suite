import { describe, expect, it } from 'vitest'
import {
  computeEntitlement,
  seniorityBonus,
} from '../../server/services/leave/accrual'
import {
  computeBalance,
  computeOvertimeBalance,
  hoursToDays,
} from '../../server/services/leave/balance'
import {
  countLeaveDays,
  eachIsoDate,
  isValidIsoDate,
  maxConcurrentAbsences,
} from '../../server/services/leave/working-days'
import { findOverlaps, rangesOverlap, validateLeaveRequest } from '../../server/services/leave/validation'

describe('working-days', () => {
  it('valida fechas ISO', () => {
    expect(isValidIsoDate('2026-01-05')).toBe(true)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('05/01/2026')).toBe(false)
  })

  it('genera rangos inclusivos', () => {
    expect(eachIsoDate('2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
    expect(eachIsoDate('2026-01-03', '2026-01-01')).toEqual([])
  })

  it('cuenta días naturales', () => {
    expect(countLeaveDays('2026-01-01', '2026-01-07', { mode: 'natural' })).toBe(7)
  })

  it('cuenta días laborables excluyendo fin de semana', () => {
    // 2026-01-05 es lunes y 2026-01-11 domingo.
    expect(countLeaveDays('2026-01-05', '2026-01-09', { mode: 'working' })).toBe(5)
    expect(countLeaveDays('2026-01-05', '2026-01-11', { mode: 'working' })).toBe(5)
  })

  it('excluye festivos en modo laborable', () => {
    expect(
      countLeaveDays('2026-01-05', '2026-01-09', {
        mode: 'working',
        holidays: ['2026-01-06'],
      }),
    ).toBe(4)
  })

  it('respeta semanas laborables configuradas', () => {
    // Con lunes a sábado, el sábado cuenta.
    expect(
      countLeaveDays('2026-01-05', '2026-01-10', {
        mode: 'working',
        workweek: [1, 2, 3, 4, 5, 6],
      }),
    ).toBe(6)
  })

  it('calcula ausencias simultáneas máximas', () => {
    const concurrent = maxConcurrentAbsences(
      { startDate: '2026-07-01', endDate: '2026-07-10' },
      [
        { startDate: '2026-07-05', endDate: '2026-07-15' },
        { startDate: '2026-06-28', endDate: '2026-07-02' },
      ],
    )
    expect(concurrent).toBe(2)

    expect(
      maxConcurrentAbsences(
        { startDate: '2026-07-01', endDate: '2026-07-10' },
        [
          { startDate: '2026-07-05', endDate: '2026-07-15' },
          { startDate: '2026-07-06', endDate: '2026-07-08' },
        ],
      ),
    ).toBe(3)
  })
})

describe('accrual', () => {
  it('año completo sin antigüedad', () => {
    const result = computeEntitlement({
      year: 2026,
      annualDays: 30,
      startDate: '2020-01-01',
      mode: 'natural',
    })
    expect(result.totalDays).toBe(30)
    expect(result.serviceFraction).toBe(1)
  })

  it('prorratea el alta a mitad de año', () => {
    const result = computeEntitlement({
      year: 2026,
      annualDays: 30,
      startDate: '2026-07-01',
      mode: 'natural',
    })
    // 184 días de 365 → 15,12 días.
    expect(result.totalDays).toBeCloseTo(15.12, 1)
  })

  it('prorratea la baja', () => {
    const result = computeEntitlement({
      year: 2026,
      annualDays: 30,
      startDate: '2020-01-01',
      endDate: '2026-03-31',
      mode: 'natural',
    })
    expect(result.totalDays).toBeCloseTo(7.4, 1)
  })

  it('devuelve cero si el contrato no toca el año', () => {
    expect(
      computeEntitlement({
        year: 2026,
        annualDays: 30,
        startDate: '2027-01-01',
        mode: 'natural',
      }).totalDays,
    ).toBe(0)
  })

  it('suma bonus de antigüedad por tramos', () => {
    expect(
      seniorityBonus(2026, '2016-01-01', { everyYears: 5, extraDays: 1 }),
    ).toBe(2)
    expect(
      seniorityBonus(2026, '2016-01-01', { everyYears: 5, extraDays: 1, maxExtraDays: 1 }),
    ).toBe(1)
  })

  it('incluye antigüedad prorrateada en el derecho', () => {
    const result = computeEntitlement({
      year: 2026,
      annualDays: 30,
      startDate: '2020-01-01',
      mode: 'natural',
      seniority: { startDate: '2016-01-01', rule: { everyYears: 5, extraDays: 1 } },
    })
    expect(result.seniorityBonusDays).toBe(2)
    expect(result.totalDays).toBe(32)
  })
})

describe('balance', () => {
  it('descuenta disfrutado y reservado', () => {
    const balance = computeBalance({
      entitledDays: 30,
      carriedOverDays: 2,
      adjustmentDays: -1,
      approvedDays: 10,
      pendingDays: 3,
    })
    expect(balance.totalDays).toBe(31)
    expect(balance.usedDays).toBe(10)
    expect(balance.reservedDays).toBe(3)
    expect(balance.availableDays).toBe(18)
  })

  it('calcula bolsa de horas', () => {
    const balance = computeOvertimeBalance([
      { hours: 10, type: 'accrued' },
      { hours: 4, type: 'used' },
      { hours: -1, type: 'adjustment' },
    ])
    expect(balance.availableHours).toBe(5)
  })

  it('convierte horas en días', () => {
    expect(hoursToDays(16, 8)).toBe(2)
    expect(hoursToDays(4, 0)).toBe(0)
  })
})

describe('validation', () => {
  const base = {
    startDate: '2026-07-01',
    endDate: '2026-07-10',
    requestedDays: 8,
    availableDays: 20,
    today: '2026-06-01',
    minNoticeDays: 15,
    overlaps: [] as Array<{ startDate: string; endDate: string }>,
    coverage: null,
  }

  it('acepta una solicitud válida', () => {
    expect(validateLeaveRequest(base).ok).toBe(true)
  })

  it('rechaza saldo insuficiente', () => {
    const result = validateLeaveRequest({ ...base, availableDays: 2 })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('Saldo insuficiente')
  })

  it('rechaza solapes', () => {
    const result = validateLeaveRequest({
      ...base,
      overlaps: [{ startDate: '2026-07-05', endDate: '2026-07-06' }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('solapa')
  })

  it('rechaza falta de antelación', () => {
    const result = validateLeaveRequest({ ...base, today: '2026-06-25' })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('antelación')
  })

  it('rechaza cobertura insuficiente', () => {
    const result = validateLeaveRequest({
      ...base,
      coverage: { departmentSize: 4, minCoverage: 2, maxConcurrentAbsences: 3 },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('Cobertura')
  })

  it('detecta solapes entre rangos', () => {
    expect(
      rangesOverlap(
        { startDate: '2026-01-01', endDate: '2026-01-10' },
        { startDate: '2026-01-10', endDate: '2026-01-20' },
      ),
    ).toBe(true)
    expect(
      findOverlaps({ startDate: '2026-01-01', endDate: '2026-01-05' }, [
        { startDate: '2026-01-06', endDate: '2026-01-10' },
      ]),
    ).toEqual([])
  })
})
