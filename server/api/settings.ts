import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../database/schema'
import { getContext, getSettingsForOrg } from '../utils/hr'
import { recordAudit } from '../utils/audit'

const settingsSchema = z.object({
  vacationMode: z.enum(['natural', 'working']).optional(),
  annualVacationDays: z.number().min(0).max(365).optional(),
  carryOverCap: z.number().min(0).max(365).optional(),
  minNoticeDays: z.number().int().min(0).max(180).optional(),
  workweek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  overtimeHoursPerDay: z.number().positive().max(24).optional(),
  attendanceToleranceMinutes: z.number().int().min(0).max(120).optional(),
  defaultScheduleStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  defaultScheduleEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  approvalLevels: z.number().int().min(1).max(2).optional(),
  seniority: z
    .object({
      everyYears: z.number().int().positive(),
      extraDays: z.number().min(0),
      maxExtraDays: z.number().min(0).optional(),
    })
    .nullable()
    .optional(),
})

const KEYS = [
  'vacationMode',
  'annualVacationDays',
  'carryOverCap',
  'minNoticeDays',
  'workweek',
  'overtimeHoursPerDay',
  'attendanceToleranceMinutes',
  'defaultScheduleStart',
  'defaultScheduleEnd',
  'approvalLevels',
  'seniority',
] as const

export default defineEventHandler(async (event) => {
  const { db, user, org } = await getContext(event)

  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo administración puede ver o cambiar la configuración',
    })
  }

  if (event.method === 'GET') {
    return getSettingsForOrg(db, org.id)
  }

  const parsed = settingsSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Configuración inválida' })
  }

  const before = await getSettingsForOrg(db, org.id)
  const now = new Date()

  for (const key of KEYS) {
    if (!(key in parsed.data)) continue
    const value = parsed.data[key]

    const [existing] = await db
      .select()
      .from(schema.settings)
      .where(and(eq(schema.settings.orgId, org.id), eq(schema.settings.key, key)))
      .limit(1)

    if (existing) {
      await db
        .update(schema.settings)
        .set({ value: JSON.stringify(value), updatedAt: now })
        .where(eq(schema.settings.id, existing.id))
    } else {
      await db.insert(schema.settings).values({
        id: crypto.randomUUID(),
        orgId: org.id,
        key,
        value: JSON.stringify(value),
        updatedAt: now,
      })
    }
  }

  const after = await getSettingsForOrg(db, org.id)

  await recordAudit(db, {
    orgId: org.id,
    actorUserId: user.id,
    action: 'settings.update',
    entity: 'settings',
    entityId: org.id,
    before,
    after,
  })

  return after
})
