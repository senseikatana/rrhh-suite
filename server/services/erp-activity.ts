import type { Db } from '../database/client'
import * as schema from '../database/schema'

/**
 * Escritor del log de actividad (migrado de `services/activity.py`).
 *
 * Cada cambio de estado pasa por `recordActivity`. Ese es el punto: si un
 * camino de código muta datos de negocio sin registrar, los KPIs se
 * infrarreportan y la auditoría queda con agujeros.
 *
 * El escritor no confirma la transacción: quien llama es dueño del `tx`, para
 * que un fallo al registrar no deje un cambio confirmado sin anotar.
 */
export interface ActivityInput {
  orgId: string
  actorId?: string | null
  actorUsername: string
  /** p.ej. "sales_order", "purchase_order", "item". */
  entity: string
  /** p.ej. "created", "status_changed", "received", "qc_approved". */
  action: string
  entityId?: string | null
  summary?: string | null
  payload?: Record<string, unknown> | null
}

type ActivityDb = Db | Parameters<Parameters<Db['transaction']>[0]>[0]

export async function recordActivity(db: ActivityDb, input: ActivityInput) {
  await db.insert(schema.erpActivityEvents).values({
    id: crypto.randomUUID(),
    occurredAt: new Date(),
    orgId: input.orgId,
    actorId: input.actorId ?? null,
    actorUsername: input.actorUsername,
    entity: input.entity,
    entityId: input.entityId ?? null,
    action: input.action,
    summary: input.summary ?? null,
    payload: input.payload ?? null,
  })
}
