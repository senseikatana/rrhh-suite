import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { Db } from '../database/client'
import * as schema from '../database/schema'
import { mergeSettings, type OrgSettings } from '../services/settings'
import type { Role } from './session'

export async function getOrganization(db: Db) {
  const [organization] = await db.select().from(schema.organizations).limit(1)
  return organization
}

export async function getSettingsForOrg(db: Db, orgId: string): Promise<OrgSettings> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.orgId, orgId))
  const raw: Record<string, string> = {}
  for (const row of rows) raw[row.key] = row.value
  return mergeSettings(raw)
}

export async function getEmployeeByUserId(db: Db, userId: string) {
  const [employee] = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.userId, userId))
    .limit(1)
  return employee
}

export async function getActiveEmployees(db: Db, orgId: string) {
  return db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.orgId, orgId), eq(schema.employees.active, true)))
}

/**
 * Contexto de la petición: usuario autenticado, empleado vinculado,
 * organización y configuración. Lanza 400 si no hay empresa configurada.
 */
export async function getContext(event: H3Event) {
  const session = await requireUser(event)
  const db = useDb()
  const org = await getOrganization(db)

  if (!org) {
    throw createError({
      statusCode: 500,
      statusMessage: 'No hay ninguna empresa configurada. Ejecuta el seed.',
    })
  }

  const employee = await getEmployeeByUserId(db, session.user.id)
  const settings = await getSettingsForOrg(db, org.id)

  return {
    db,
    user: session.user,
    employee,
    org,
    settings,
  }
}

export async function canApprove(
  db: Db,
  user: { id: string; role: Role },
  employee: { id: string } | undefined,
  departmentId: string | null,
): Promise<boolean> {
  if (user.role === 'admin') return true
  if (user.role !== 'manager' || !employee) return false
  if (!departmentId) return false

  const [rule] = await db
    .select()
    .from(schema.approvalRules)
    .where(
      and(
        eq(schema.approvalRules.departmentId, departmentId),
        eq(schema.approvalRules.approverEmployeeId, employee.id),
      ),
    )
    .limit(1)

  return Boolean(rule)
}

export async function getApproverForDepartment(db: Db, orgId: string, departmentId: string | null) {
  if (!departmentId) return null

  const [rule] = await db
    .select()
    .from(schema.approvalRules)
    .where(
      and(
        eq(schema.approvalRules.orgId, orgId),
        eq(schema.approvalRules.departmentId, departmentId),
      ),
    )
    .limit(1)

  if (!rule) return null

  const [approver] = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.id, rule.approverEmployeeId))
    .limit(1)

  return approver ?? null
}

export function employeeName(employee: { firstName: string; lastName: string } | null | undefined) {
  return employee ? `${employee.firstName} ${employee.lastName}`.trim() : ''
}
