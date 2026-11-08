import type { SeniorityRule } from './leave/accrual'
import type { VacationMode } from './leave/working-days'
import { DEFAULT_WORKWEEK } from './leave/working-days'

export interface OrgSettings {
  vacationMode: VacationMode
  annualVacationDays: number
  carryOverCap: number
  minNoticeDays: number
  /** 0 = domingo … 6 = sábado. */
  workweek: number[]
  overtimeHoursPerDay: number
  /** Margen en minutos antes de considerar exceso o defecto de jornada. */
  attendanceToleranceMinutes: number
  /** Horario contractual por defecto de la empresa (HH:mm). */
  defaultScheduleStart: string | null
  defaultScheduleEnd: string | null
  seniority: SeniorityRule | null
  /** Niveles de aprobación requeridos (1 = manager, 2 = manager + RRHH). */
  approvalLevels: number
}

export const DEFAULT_SETTINGS: OrgSettings = {
  vacationMode: 'natural',
  annualVacationDays: 30,
  carryOverCap: 0,
  minNoticeDays: 15,
  workweek: [...DEFAULT_WORKWEEK],
  overtimeHoursPerDay: 8,
  attendanceToleranceMinutes: 5,
  defaultScheduleStart: null,
  defaultScheduleEnd: null,
  seniority: null,
  approvalLevels: 1,
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function asTime(value: unknown): string | null {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : null
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/** Combina los ajustes guardados (JSON por clave) con los valores por defecto. */
export function mergeSettings(raw: Record<string, string | undefined | null>): OrgSettings {
  const parsed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') parsed[key] = parseJson(value)
  }

  const mode = parsed.vacationMode
  const workweek = Array.isArray(parsed.workweek)
    ? parsed.workweek.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    : DEFAULT_SETTINGS.workweek

  const seniorityRaw = parsed.seniority
  const seniority: SeniorityRule | null =
    seniorityRaw && typeof seniorityRaw === 'object'
      ? {
          everyYears: asNumber((seniorityRaw as SeniorityRule).everyYears, 5),
          extraDays: asNumber((seniorityRaw as SeniorityRule).extraDays, 1),
          maxExtraDays: (seniorityRaw as SeniorityRule).maxExtraDays,
        }
      : null

  return {
    vacationMode: mode === 'working' || mode === 'natural' ? mode : DEFAULT_SETTINGS.vacationMode,
    annualVacationDays: asNumber(parsed.annualVacationDays, DEFAULT_SETTINGS.annualVacationDays),
    carryOverCap: asNumber(parsed.carryOverCap, DEFAULT_SETTINGS.carryOverCap),
    minNoticeDays: asNumber(parsed.minNoticeDays, DEFAULT_SETTINGS.minNoticeDays),
    workweek: workweek.length > 0 ? workweek : DEFAULT_SETTINGS.workweek,
    overtimeHoursPerDay: asNumber(parsed.overtimeHoursPerDay, DEFAULT_SETTINGS.overtimeHoursPerDay),
    attendanceToleranceMinutes: asNumber(
      parsed.attendanceToleranceMinutes,
      DEFAULT_SETTINGS.attendanceToleranceMinutes,
    ),
    defaultScheduleStart: asTime(parsed.defaultScheduleStart),
    defaultScheduleEnd: asTime(parsed.defaultScheduleEnd),
    seniority,
    approvalLevels: Math.max(1, asNumber(parsed.approvalLevels, DEFAULT_SETTINGS.approvalLevels)),
  }
}

/** Comprueba si un día de la semana es laborable según la configuración. */
export function isWorkingWeekday(weekday: number, workweek: number[]): boolean {
  return workweek.includes(weekday)
}

export function isPaidLeave(paid: boolean, fallback = true): boolean {
  return asBoolean(paid, fallback)
}
