/**
 * Seed de demostración: hotel con 25 empleados, 3 departamentos,
 * festivos, tipos de permiso, derechos de vacaciones y solicitudes.
 *
 * Ejecutar con: bun run db:seed
 * Si ya hay datos, no hace nada salvo SEED_FORCE=1.
 */
import { hashPassword } from 'better-auth/crypto'
import { addDays, format, subDays } from 'date-fns'
import { closeDb, createDb } from './client'
import * as schema from './schema'
import { computeEntitlement } from '../services/leave/accrual'
import { countLeaveDays } from '../services/leave/working-days'
import { DEFAULT_SETTINGS, mergeSettings } from '../services/settings'

const db = createDb()
const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const iso = (date: Date) => format(date, 'yyyy-MM-dd')

async function main() {
  const existing = await db.select().from(schema.employees)
  if (existing.length > 0 && process.env.SEED_FORCE !== '1') {
    console.log(`Ya existen ${existing.length} empleados. Usa SEED_FORCE=1 para volver a sembrar.`)
    return
  }

  const settings = mergeSettings({
    vacationMode: JSON.stringify('natural'),
    annualVacationDays: JSON.stringify(30),
    carryOverCap: JSON.stringify(2),
    minNoticeDays: JSON.stringify(15),
    workweek: JSON.stringify([1, 2, 3, 4, 5]),
    overtimeHoursPerDay: JSON.stringify(8),
    attendanceToleranceMinutes: JSON.stringify(5),
    defaultScheduleStart: JSON.stringify('07:20'),
    defaultScheduleEnd: JSON.stringify('14:50'),
    seniority: JSON.stringify({ everyYears: 5, extraDays: 1, maxExtraDays: 5 }),
    approvalLevels: JSON.stringify(1),
  })

  const orgId = 'org-hotelmarina'
  const createdAt = now

  await db.insert(schema.organizations).values({
    id: orgId,
    name: 'Hotel Marina Salou',
    slug: 'hotel-marina-salou',
    timezone: 'Europe/Madrid',
    createdAt,
    updatedAt: createdAt,
  })

  for (const [key, value] of Object.entries({
    vacationMode: settings.vacationMode,
    annualVacationDays: settings.annualVacationDays,
    carryOverCap: settings.carryOverCap,
    minNoticeDays: settings.minNoticeDays,
    workweek: settings.workweek,
    overtimeHoursPerDay: settings.overtimeHoursPerDay,
    attendanceToleranceMinutes: settings.attendanceToleranceMinutes,
    defaultScheduleStart: settings.defaultScheduleStart,
    defaultScheduleEnd: settings.defaultScheduleEnd,
    seniority: settings.seniority,
    approvalLevels: settings.approvalLevels,
  })) {
    await db.insert(schema.settings).values({
      id: `set-${key}`,
      orgId,
      key,
      value: JSON.stringify(value ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]),
      updatedAt: createdAt,
    })
  }

  const departments = [
    { id: 'dep-recepcion', name: 'Recepción', color: '#0ea5e9', minCoverage: 2 },
    { id: 'dep-cocina', name: 'Cocina', color: '#f97316', minCoverage: 3 },
    { id: 'dep-pisos', name: 'Pisos', color: '#a855f7', minCoverage: 4 },
  ]
  for (const dept of departments) {
    await db.insert(schema.departments).values({ ...dept, orgId, createdAt })
  }

  const passwordHash = {
    admin: await hashPassword('Admin1234!'),
    manager: await hashPassword('Manager1234!'),
    employee: await hashPassword('Empleado1234!'),
  }

  const accounts = [
    {
      id: 'usr-admin',
      name: 'Laura Ferrer',
      email: 'admin@hotelmarina.test',
      role: 'admin' as const,
      password: passwordHash.admin,
    },
    {
      id: 'usr-manager',
      name: 'Marc Puig',
      email: 'manager@hotelmarina.test',
      role: 'manager' as const,
      password: passwordHash.manager,
    },
    {
      id: 'usr-employee',
      name: 'Nuria Solé',
      email: 'empleado@hotelmarina.test',
      role: 'employee' as const,
      password: passwordHash.employee,
    },
  ]

  for (const account of accounts) {
    await db.insert(schema.user).values({
      id: account.id,
      name: account.name,
      email: account.email,
      emailVerified: true,
      role: account.role,
      createdAt,
      updatedAt: createdAt,
    })

    await db.insert(schema.account).values({
      id: `acc-${account.id}`,
      accountId: account.id,
      providerId: 'credential',
      userId: account.id,
      password: account.password,
      createdAt,
      updatedAt: createdAt,
    })
  }

  interface SeedEmployee {
    id: string
    firstName: string
    lastName: string
    departmentId: string | null
    position: string
    startDate: string
    userId?: string
  }

  const people: SeedEmployee[] = [
    { id: 'emp-admin', firstName: 'Laura', lastName: 'Ferrer', departmentId: null, position: 'Responsable de RRHH', startDate: '2015-02-01', userId: 'usr-admin' },
    { id: 'emp-manager', firstName: 'Marc', lastName: 'Puig', departmentId: 'dep-recepcion', position: 'Jefe de Recepción', startDate: '2014-05-12', userId: 'usr-manager' },
    { id: 'emp-employee', firstName: 'Nuria', lastName: 'Solé', departmentId: 'dep-recepcion', position: 'Recepcionista', startDate: '2019-06-01', userId: 'usr-employee' },
    { id: 'emp-004', firstName: 'Ana', lastName: 'Beltrán', departmentId: 'dep-recepcion', position: 'Recepcionista', startDate: '2021-03-15' },
    { id: 'emp-005', firstName: 'Jordi', lastName: 'Vidal', departmentId: 'dep-recepcion', position: 'Recepcionista', startDate: '2018-09-01' },
    { id: 'emp-006', firstName: 'Elena', lastName: 'Romero', departmentId: 'dep-recepcion', position: 'Recepcionista', startDate: '2022-01-10' },
    { id: 'emp-007', firstName: 'Pablo', lastName: 'Márquez', departmentId: 'dep-recepcion', position: 'Night Audit', startDate: '2020-07-01' },
    { id: 'emp-008', firstName: 'Sara', lastName: 'Costa', departmentId: 'dep-recepcion', position: 'Recepcionista', startDate: '2023-04-03' },
    { id: 'emp-009', firstName: 'Ferran', lastName: 'Bosch', departmentId: 'dep-cocina', position: 'Jefe de Cocina', startDate: '2012-02-20' },
    { id: 'emp-010', firstName: 'Marta', lastName: 'Ríos', departmentId: 'dep-cocina', position: 'Cocinera', startDate: '2016-10-01' },
    { id: 'emp-011', firstName: 'Diego', lastName: 'Navarro', departmentId: 'dep-cocina', position: 'Cocinero', startDate: '2019-02-11' },
    { id: 'emp-012', firstName: 'Lucía', lastName: 'Pons', departmentId: 'dep-cocina', position: 'Ayudante de cocina', startDate: '2021-06-07' },
    { id: 'emp-013', firstName: 'Iván', lastName: 'Serra', departmentId: 'dep-cocina', position: 'Cocinero', startDate: '2017-08-14' },
    { id: 'emp-014', firstName: 'Paula', lastName: 'Gil', departmentId: 'dep-cocina', position: 'Ayudante de cocina', startDate: '2023-09-04' },
    { id: 'emp-015', firstName: 'Hugo', lastName: 'Ramos', departmentId: 'dep-cocina', position: 'Fregador', startDate: '2024-03-01' },
    { id: 'emp-016', firstName: 'Alba', lastName: 'Mir', departmentId: 'dep-cocina', position: 'Pastelera', startDate: '2018-01-15' },
    { id: 'emp-017', firstName: 'Carmen', lastName: 'León', departmentId: 'dep-pisos', position: 'Gobernanta', startDate: '2011-11-02' },
    { id: 'emp-018', firstName: 'Rosa', lastName: 'Díaz', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: '2015-05-18' },
    { id: 'emp-019', firstName: 'Montse', lastName: 'Vila', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: '2017-03-06' },
    { id: 'emp-020', firstName: 'Yolanda', lastName: 'Ortiz', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: '2019-09-09' },
    { id: 'emp-021', firstName: 'Beatriz', lastName: 'Campos', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: '2020-06-22' },
    { id: 'emp-022', firstName: 'Silvia', lastName: 'Herrera', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: '2021-04-12' },
    { id: 'emp-023', firstName: 'Patricia', lastName: 'Núñez', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: '2022-08-01' },
    { id: 'emp-024', firstName: 'Raquel', lastName: 'Blanco', departmentId: 'dep-pisos', position: 'Lavandería', startDate: '2023-02-13' },
    { id: 'emp-025', firstName: 'Sonia', lastName: 'Ferrer', departmentId: 'dep-pisos', position: 'Camarera de pisos', startDate: iso(subDays(now, 120)) },
  ]

  for (const [index, person] of people.entries()) {
    const slug = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
    const email = `${slug(person.firstName)}.${slug(person.lastName)}@hotelmarina.test`

    await db.insert(schema.employees).values({
      id: person.id,
      orgId,
      departmentId: person.departmentId,
      userId: person.userId ?? null,
      firstName: person.firstName,
      lastName: person.lastName,
      email,
      phone: `+34 600 00 ${String(10 + index).padStart(2, '0')} ${String(10 + index).padStart(2, '0')}`,
      pin: String(1001 + index),
      position: person.position,
      startDate: person.startDate,
      weeklyHours: 40,
      active: true,
      createdAt,
      updatedAt: createdAt,
    })

    await db.insert(schema.contracts).values({
      id: `con-${person.id}`,
      employeeId: person.id,
      type: 'indefinido',
      startDate: person.startDate,
      weeklyHours: 40,
      convenio: 'Convenio colectivo de hostelería de Tarragona',
      createdAt,
    })
  }

  const leaveTypes = [
    { id: 'lt-vac', code: 'VAC', name: 'Vacaciones', color: '#22c55e', paid: true, requiresApproval: true, countsAgainstBalance: true, unit: 'days' as const },
    { id: 'lt-asu', code: 'ASU', name: 'Asuntos propios', color: '#3b82f6', paid: true, requiresApproval: true, countsAgainstBalance: false, unit: 'days' as const },
    { id: 'lt-baja', code: 'BAJA', name: 'Baja médica', color: '#ef4444', paid: false, requiresApproval: false, countsAgainstBalance: false, unit: 'days' as const },
    { id: 'lt-per', code: 'PER', name: 'Permiso retribuido', color: '#f59e0b', paid: true, requiresApproval: true, countsAgainstBalance: false, unit: 'days' as const },
    { id: 'lt-comp', code: 'COMP', name: 'Compensación de horas', color: '#8b5cf6', paid: true, requiresApproval: true, countsAgainstBalance: true, unit: 'days' as const },
  ]

  for (const type of leaveTypes) {
    await db.insert(schema.leaveTypes).values({ ...type, orgId, active: true })
  }

  // Festivos anuales (fechas fijas; la Semana Santa se añade manualmente).
  const fixedHolidays: Array<[string, string, 'nacional' | 'autonomico' | 'local']> = [
    ['01-01', 'Año Nuevo', 'nacional'],
    ['01-06', 'Reyes Magos', 'nacional'],
    ['05-01', 'Fiesta del Trabajo', 'nacional'],
    ['06-24', 'San Juan', 'autonomico'],
    ['08-15', 'Asunción de la Virgen', 'nacional'],
    ['09-11', 'Diada Nacional de Cataluña', 'autonomico'],
    ['10-12', 'Fiesta Nacional de España', 'nacional'],
    ['11-01', 'Todos los Santos', 'nacional'],
    ['12-06', 'Día de la Constitución', 'nacional'],
    ['12-08', 'Inmaculada Concepción', 'nacional'],
    ['12-25', 'Navidad', 'nacional'],
    ['12-26', 'San Esteban', 'autonomico'],
  ]

  for (const year of [CURRENT_YEAR, CURRENT_YEAR + 1]) {
    for (const [index, [monthDay, name, scope]] of fixedHolidays.entries()) {
      await db.insert(schema.holidays).values({
        id: `hol-${year}-${index}`,
        orgId,
        date: `${year}-${monthDay}`,
        name,
        scope,
        year,
      })
    }
  }

  const holidayDates = (year: number) => fixedHolidays.map(([monthDay]) => `${year}-${monthDay}`)

  for (const person of people) {
    for (const year of [CURRENT_YEAR, CURRENT_YEAR + 1]) {
      const entitlement = computeEntitlement({
        year,
        annualDays: settings.annualVacationDays,
        startDate: person.startDate,
        mode: settings.vacationMode,
        holidays: holidayDates(year),
        workweek: settings.workweek,
        seniority: settings.seniority
          ? { startDate: person.startDate, rule: settings.seniority }
          : null,
      })

      await db.insert(schema.leaveEntitlements).values({
        id: `ent-${person.id}-${year}`,
        employeeId: person.id,
        leaveTypeId: 'lt-vac',
        year,
        entitledDays: entitlement.totalDays,
        carriedOverDays: 0,
        adjustmentDays: 0,
        notes: null,
      })
    }
  }

  const addRequest = async (input: {
    id: string
    employeeId: string
    typeId: string
    start: string
    end: string
    status: 'pending' | 'approved' | 'rejected'
    reason?: string
    decidedBy?: string
  }) => {
    const days = countLeaveDays(input.start, input.end, {
      mode: settings.vacationMode,
      holidays: [
        ...holidayDates(new Date(input.start).getFullYear()),
        ...holidayDates(new Date(input.end).getFullYear()),
      ],
      workweek: settings.workweek,
    })

    await db.insert(schema.leaveRequests).values({
      id: input.id,
      orgId,
      employeeId: input.employeeId,
      leaveTypeId: input.typeId,
      startDate: input.start,
      endDate: input.end,
      days,
      status: input.status,
      reason: input.reason ?? null,
      decidedBy: input.decidedBy ?? null,
      decidedAt: input.status === 'pending' ? null : createdAt,
      createdAt,
      updatedAt: createdAt,
    })
  }

  await addRequest({
    id: 'req-001',
    employeeId: 'emp-employee',
    typeId: 'lt-vac',
    start: iso(addDays(now, 40)),
    end: iso(addDays(now, 53)),
    status: 'approved',
    reason: 'Vacaciones de verano',
    decidedBy: 'emp-manager',
  })
  await addRequest({
    id: 'req-002',
    employeeId: 'emp-004',
    typeId: 'lt-vac',
    start: iso(addDays(now, 30)),
    end: iso(addDays(now, 39)),
    status: 'pending',
    reason: 'Viaje familiar',
  })
  await addRequest({
    id: 'req-003',
    employeeId: 'emp-011',
    typeId: 'lt-vac',
    start: iso(addDays(now, 25)),
    end: iso(addDays(now, 32)),
    status: 'pending',
    reason: 'Descanso',
  })
  await addRequest({
    id: 'req-004',
    employeeId: 'emp-019',
    typeId: 'lt-asu',
    start: iso(addDays(now, 12)),
    end: iso(addDays(now, 12)),
    status: 'pending',
    reason: 'Trámite personal',
  })
  await addRequest({
    id: 'req-005',
    employeeId: 'emp-013',
    typeId: 'lt-vac',
    start: iso(subDays(now, 60)),
    end: iso(subDays(now, 51)),
    status: 'approved',
    reason: 'Vacaciones',
    decidedBy: 'emp-009',
  })

  const overtime = [
    { id: 'ot-001', employeeId: 'emp-employee', hours: 6, type: 'accrued' as const, date: iso(subDays(now, 20)), note: 'Cierre de mes' },
    { id: 'ot-002', employeeId: 'emp-employee', hours: 4, type: 'accrued' as const, date: iso(subDays(now, 8)), note: 'Inventario' },
    { id: 'ot-003', employeeId: 'emp-010', hours: 10, type: 'accrued' as const, date: iso(subDays(now, 30)), note: 'Evento privado' },
  ]
  for (const entry of overtime) {
    await db.insert(schema.overtimeLedger).values({ ...entry, createdAt })
  }

  const rules = [
    { id: 'rule-recepcion', departmentId: 'dep-recepcion', approverEmployeeId: 'emp-manager' },
    { id: 'rule-cocina', departmentId: 'dep-cocina', approverEmployeeId: 'emp-009' },
    { id: 'rule-pisos', departmentId: 'dep-pisos', approverEmployeeId: 'emp-017' },
  ]
  for (const rule of rules) {
    await db.insert(schema.approvalRules).values({ ...rule, orgId, level: 1 })
  }

  console.log('✓ Seed completado')
  console.log('  admin@hotelmarina.test     / Admin1234!')
  console.log('  manager@hotelmarina.test   / Manager1234!')
  console.log('  empleado@hotelmarina.test  / Empleado1234!')
}

main()
  .then(async () => {
    await closeDb()
  })
  .catch(async (error) => {
    console.error(error)
    await closeDb()
    process.exit(1)
  })
