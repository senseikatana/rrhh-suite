import { and, eq, lte, sql } from 'drizzle-orm'
import * as schema from '../../../database/schema'
import { getErpContext } from '../../../utils/erp'
import {
  alerts,
  computeAll,
  operationalCounts,
} from '../../../services/erp-kpi'

/**
 * Resumen del dashboard ERP: bloque de KPIs y contadores de cabecera.
 * Los KPIs se calculan del log de actividad; hasta que haya eventos, la
 * métrica vuelve null y el cliente la muestra como "sin datos".
 */
export default defineEventHandler(async (event) => {
  const { db, orgId } = await getErpContext(event)

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)

  const kpis = await computeAll(db, orgId)
  const counts = await operationalCounts(db, orgId)

  return {
    company_code: org?.slug ?? orgId,
    generated_at: new Date().toISOString(),
    kpis,
    ...counts,
    alerts: await alerts(db, orgId),
  }
})
