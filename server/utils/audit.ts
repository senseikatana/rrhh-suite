import type { Db } from '../database/client'
import * as schema from '../database/schema'

export interface AuditInput {
  orgId?: string | null
  actorUserId?: string | null
  action: string
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
}

export async function recordAudit(db: Db, input: AuditInput) {
  await db.insert(schema.auditLog).values({
    id: crypto.randomUUID(),
    orgId: input.orgId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before: input.before === undefined ? null : JSON.stringify(input.before),
    after: input.after === undefined ? null : JSON.stringify(input.after),
    createdAt: new Date(),
  })
}
