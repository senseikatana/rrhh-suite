import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import * as schema from '../database/schema'
import type { ErpActor } from '../utils/erp'
import { recordActivity } from './erp-activity'

/**
 * Generación de la hoja de demanda (migrado de `services/demand_service.py`).
 *
 * Las líneas de demanda se derivan de dos entradas: stock por debajo del mínimo
 * y stock comprometido en pedidos de venta abiertos. La hoja se reconstruye bajo
 * demanda en vez de mantenerse sincronizada, así no puede desincronizarse.
 */

export type DemandSource = 'SALES_ORDER' | 'MIN_STOCK' | 'FORECAST'
export type DemandAction = 'PENDING' | 'ORDERED' | 'IGNORED'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export interface DemandGenerateParams {
  coverageRatio: number
  horizonDays: number
}

/** Reconstruye la hoja de demanda pendiente de una organización. */
export async function generate(
  tx: Tx,
  orgId: string,
  actor: ErpActor,
  params: DemandGenerateParams,
) {
  const today = new Date()
  const horizonEnd = new Date(today.getTime() + params.horizonDays * 86400000)
    .toISOString()
    .slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  // --- Cantidad comprometida en pedidos de venta abiertos ---
  const openStatuses = ['OPEN', 'PICKING', 'SHIPPED'] as (typeof schema.erpSalesOrders.status.enumValues)[number][]
  const committedRows = await tx
    .select({
      itemId: schema.erpSalesOrderLines.itemId,
      quantity: schema.erpSalesOrderLines.quantity,
    })
    .from(schema.erpSalesOrderLines)
    .innerJoin(
      schema.erpSalesOrders,
      eq(schema.erpSalesOrders.id, schema.erpSalesOrderLines.orderId),
    )
    .where(
      and(
        eq(schema.erpSalesOrders.orgId, orgId),
        inArray(schema.erpSalesOrders.status, openStatuses),
        sql`${schema.erpSalesOrders.deliveryDate} is not null`,
        lte(schema.erpSalesOrders.deliveryDate, horizonEnd),
      ),
    )

  const committed = new Map<string, number>()
  for (const row of committedRows) {
    committed.set(row.itemId, (committed.get(row.itemId) ?? 0) + Number(row.quantity))
  }

  // --- Requerimiento por artículo ---
  const items = await tx
    .select()
    .from(schema.erpItems)
    .where(eq(schema.erpItems.orgId, orgId))

  const requirements = new Map<
    string,
    { quantity: number; source: DemandSource; requiredDate: string }
  >()

  for (const item of items) {
    const target = Number(item.minStock) * params.coverageRatio
    // El stock comprometido en pedidos abiertos es mercancía que VA A SALIR:
    // el requerimiento crece con `committed`, no encoge.
    const shortage = target - Number(item.stock) + (committed.get(item.id) ?? 0)
    if (shortage <= 0) continue

    const source: DemandSource =
      Number(item.stock) < Number(item.minStock)
        ? 'MIN_STOCK'
        : committed.has(item.id)
          ? 'SALES_ORDER'
          : 'FORECAST'

    const requiredDate = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    requirements.set(item.id, { quantity: shortage, source, requiredDate })
  }

  // --- Sustituir la hoja pendiente ---
  await tx
    .delete(schema.erpDemandLines)
    .where(
      and(
        eq(schema.erpDemandLines.orgId, orgId),
        eq(schema.erpDemandLines.action, 'PENDING'),
      ),
    )

  const created: (typeof schema.erpDemandLines.$inferInsert)[] = []
  for (const [itemId, req] of requirements) {
    created.push({
      id: crypto.randomUUID(),
      orgId,
      itemId,
      requiredDate: req.requiredDate,
      quantityNeeded: req.quantity.toFixed(3),
      source: req.source,
      action: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
  if (created.length) await tx.insert(schema.erpDemandLines).values(created)

  await recordActivity(tx, {
    orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    entity: 'demand',
    action: 'regenerated',
    summary: `Rebuilt demand worksheet (${created.length} line(s))`,
    payload: {
      lines: created.length,
      coverage_ratio: String(params.coverageRatio),
      horizon_days: params.horizonDays,
    },
  })

  return created
}
