import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { getContext } from '../../utils/hr'

export default defineEventHandler(async (event) => {
  const { db, org } = await getContext(event)

  const departments = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.orgId, org.id))

  const employees = await db
    .select({ id: schema.employees.id, departmentId: schema.employees.departmentId })
    .from(schema.employees)
    .where(eq(schema.employees.orgId, org.id))

  return departments.map((department) => ({
    ...department,
    headcount: employees.filter((employee) => employee.departmentId === department.id).length,
  }))
})
