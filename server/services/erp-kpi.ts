import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import * as schema from '../database/schema'

/**
 * Cálculo de KPIs del dashboard (migrado de `services/kpi_service.py`).
 *
 * Cada figura se deriva de datos registrados: el log de eventos de actividad y
 * las tablas operativas. Nada está hardcodeado.
 *
 * Cada métrica devuelve `null` cuando el histórico registrado no basta para
 * afirmarla. Un KPI mostrado como cero es una afirmación de que no se hizo
 * trabajo, peor que no mostrar nada. El frontend renderiza "sin datos aún" para null.
 *
 * Fórmulas
 * --------
 * order_accuracy   Unidades enviadas / unidades pedidas, en pedidos que llegaron a SHIPPED.
 * picks_per_hour   Pedidos que entraron en PICKING en la ventana / horas de actividad.
 * dock_to_stock    Horas medias entre recepción y aprobación de Calidad.
 * inventory_turnover  Coste de lo vendido / valor medio del inventario.
 */

export interface Kpi {
  key: string
  value: number | null
  unit: string
}

function windowStart(days: number) {
  return new Date(Date.now() - days * 86400000)
}

export async function orderAccuracy(tx: Db, orgId: string, days = 30): Promise<Kpi> {
  const since = windowStart(days).toISOString().slice(0, 10)
  const [row] = await tx
    .select({
      ordered: sql<string>`coalesce(sum(${schema.erpSalesOrderLines.quantity}), 0)`,
      shipped: sql<string>`coalesce(sum(${schema.erpSalesOrderLines.qtyShipped}), 0)`,
    })
    .from(schema.erpSalesOrderLines)
    .innerJoin(
      schema.erpSalesOrders,
      eq(schema.erpSalesOrders.id, schema.erpSalesOrderLines.orderId),
    )
    .where(
      and(
        eq(schema.erpSalesOrders.orgId, orgId),
        inArray(schema.erpSalesOrders.status, ['SHIPPED', 'INVOICED']),
        sql`${schema.erpSalesOrders.orderDate} >= ${since}`,
      ),
    )

  const ordered = Number(row?.ordered ?? 0)
  const shipped = Number(row?.shipped ?? 0)
  if (ordered === 0) return { key: 'order_accuracy', value: null, unit: '%' }
  return {
    key: 'order_accuracy',
    value: Math.round((shipped / ordered) * 1000) / 10,
    unit: '%',
  }
}

export async function picksPerHour(tx: Db, orgId: string, days = 30): Promise<Kpi> {
  const since = windowStart(days)
  const rows = await tx
    .select({ occurredAt: schema.erpActivityEvents.occurredAt })
    .from(schema.erpActivityEvents)
    .where(
      and(
        eq(schema.erpActivityEvents.orgId, orgId),
        eq(schema.erpActivityEvents.entity, 'sales_order'),
        eq(schema.erpActivityEvents.action, 'status_changed'),
        gte(schema.erpActivityEvents.occurredAt, since),
        sql`${schema.erpActivityEvents.payload}->>'to' = 'PICKING'`,
      ),
    )
    .orderBy(schema.erpActivityEvents.occurredAt)

  if (!rows.length) return { key: 'picks_per_hour', value: null, unit: 'orders/h' }

  const first = new Date(rows[0]!.occurredAt).getTime()
  const last = new Date(rows[rows.length - 1]!.occurredAt).getTime()
  const spanHours = Math.max((last - first) / 3600000, 1.0)
  return {
    key: 'picks_per_hour',
    value: Math.round((rows.length / spanHours) * 10) / 10,
    unit: 'orders/h',
  }
}

export async function dockToStockHours(tx: Db, orgId: string, days = 90): Promise<Kpi> {
  const since = windowStart(days)

  const receipts = await tx
    .select({
      entityId: schema.erpActivityEvents.entityId,
      occurredAt: schema.erpActivityEvents.occurredAt,
    })
    .from(schema.erpActivityEvents)
    .where(
      and(
        eq(schema.erpActivityEvents.orgId, orgId),
        eq(schema.erpActivityEvents.entity, 'purchase_order'),
        eq(schema.erpActivityEvents.action, 'received'),
        gte(schema.erpActivityEvents.occurredAt, since),
      ),
    )

  const receiptByEntity = new Map<string, Date>()
  for (const r of receipts) {
    if (r.entityId) receiptByEntity.set(r.entityId, new Date(r.occurredAt))
  }
  if (!receiptByEntity.size) return { key: 'dock_to_stock', value: null, unit: 'h' }

  const approvals = await tx
    .select({
      entityId: schema.erpActivityEvents.entityId,
      occurredAt: schema.erpActivityEvents.occurredAt,
    })
    .from(schema.erpActivityEvents)
    .where(
      and(
        eq(schema.erpActivityEvents.orgId, orgId),
        eq(schema.erpActivityEvents.entity, 'purchase_order'),
        eq(schema.erpActivityEvents.action, 'qc_approved'),
        gte(schema.erpActivityEvents.occurredAt, since),
      ),
    )

  const durations: number[] = []
  for (const a of approvals) {
    const receivedAt = a.entityId ? receiptByEntity.get(a.entityId) : undefined
    if (!receivedAt) continue
    durations.push((new Date(a.occurredAt).getTime() - receivedAt.getTime()) / 3600000)
  }
  if (!durations.length) return { key: 'dock_to_stock', value: null, unit: 'h' }

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  return { key: 'dock_to_stock', value: Math.round(mean * 10) / 10, unit: 'h' }
}

export async function inventoryTurnover(tx: Db, orgId: string, days = 90): Promise<Kpi> {
  const since = windowStart(days).toISOString().slice(0, 10)

  const [cogsRow] = await tx
    .select({
      cogs: sql<string>`coalesce(sum(${schema.erpSalesOrderLines.quantity} * ${schema.erpSalesOrderLines.unitPrice}), 0)`,
    })
    .from(schema.erpSalesOrderLines)
    .innerJoin(
      schema.erpSalesOrders,
      eq(schema.erpSalesOrders.id, schema.erpSalesOrderLines.orderId),
    )
    .where(
      and(
        eq(schema.erpSalesOrders.orgId, orgId),
        inArray(schema.erpSalesOrders.status, ['SHIPPED', 'INVOICED']),
        sql`${schema.erpSalesOrders.orderDate} >= ${since}`,
      ),
    )

  const [invRow] = await tx
    .select({
      value: sql<string>`coalesce(sum(${schema.erpItems.stock} * ${schema.erpItems.unitCost}), 0)`,
    })
    .from(schema.erpItems)
    .where(eq(schema.erpItems.orgId, orgId))

  const inventory = Number(invRow?.value ?? 0)
  if (!inventory) return { key: 'inventory_turnover', value: null, unit: 'x' }

  const cogs = Number(cogsRow?.cogs ?? 0)
  return {
    key: 'inventory_turnover',
    value: Math.round((cogs / inventory) * 10) / 10,
    unit: 'x',
  }
}

export async function computeAll(tx: Db, orgId: string): Promise<Kpi[]> {
  return [
    await orderAccuracy(tx, orgId),
    await picksPerHour(tx, orgId),
    await dockToStockHours(tx, orgId),
    await inventoryTurnover(tx, orgId),
  ]
}

/** Contadores operativos que se muestran junto a los KPIs. */
export async function operationalCounts(tx: Db, orgId: string) {
  const count = async (q: PromiseLike<unknown>) => {
    const rows = (await q) as { c: number }[] | undefined
    return Number(rows?.[0]?.c ?? 0)
  }

  const openSales = await count(
    tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.erpSalesOrders)
      .where(
        and(
          eq(schema.erpSalesOrders.orgId, orgId),
          inArray(schema.erpSalesOrders.status, ['OPEN', 'PICKING']),
        ),
      ),
  )

  const openPurchases = await count(
    tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.erpPurchaseOrders)
      .where(
        and(
          eq(schema.erpPurchaseOrders.orgId, orgId),
          inArray(schema.erpPurchaseOrders.status, ['OPEN', 'RECEIVED', 'QC_PENDING']),
        ),
      ),
  )

  const awaitingQuality = await count(
    tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.erpPurchaseOrders)
      .where(
        and(
          eq(schema.erpPurchaseOrders.orgId, orgId),
          eq(schema.erpPurchaseOrders.status, 'QC_PENDING'),
        ),
      ),
  )

  const pendingDemand = await count(
    tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.erpDemandLines)
      .where(
        and(
          eq(schema.erpDemandLines.orgId, orgId),
          eq(schema.erpDemandLines.action, 'PENDING'),
        ),
      ),
  )

  const belowMinimum = await count(
    tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.erpItems)
      .where(
        and(
          eq(schema.erpItems.orgId, orgId),
          sql`${schema.erpItems.stock} < ${schema.erpItems.minStock}`,
        ),
      ),
  )

  const [invRow] = await tx
    .select({
      value: sql<string>`coalesce(sum(${schema.erpItems.stock} * ${schema.erpItems.unitCost}), 0)`,
    })
    .from(schema.erpItems)
    .where(eq(schema.erpItems.orgId, orgId))

  const today = new Date().toISOString().slice(0, 10)
  const routesToday = await count(
    tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.erpRoutes)
      .where(and(eq(schema.erpRoutes.orgId, orgId), eq(schema.erpRoutes.date, today))),
  )

  return {
    open_sales_orders: openSales,
    open_purchase_orders: openPurchases,
    orders_awaiting_quality: awaitingQuality,
    pending_demand_lines: pendingDemand,
    items_below_minimum: belowMinimum,
    inventory_value: Number(invRow?.value ?? 0),
    routes_today: routesToday,
  }
}

/** Avisos operativos para el panel de alertas del dashboard. */
export async function alerts(tx: Db, orgId: string) {
  const result: { severity: string; code: string; message: string }[] = []

  const lowStock = await tx
    .select({
      code: schema.erpItems.code,
      description: schema.erpItems.description,
      stock: schema.erpItems.stock,
      minStock: schema.erpItems.minStock,
    })
    .from(schema.erpItems)
    .where(
      and(
        eq(schema.erpItems.orgId, orgId),
        sql`${schema.erpItems.stock} < ${schema.erpItems.minStock}`,
      ),
    )

  for (const item of lowStock) {
    result.push({
      severity: 'critical',
      code: item.code,
      message: `${item.code} · ${item.description}: stock ${item.stock} below minimum ${item.minStock}`,
    })
  }

  const [qcRow] = await tx
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.erpPurchaseOrders)
    .where(
      and(
        eq(schema.erpPurchaseOrders.orgId, orgId),
        eq(schema.erpPurchaseOrders.status, 'QC_PENDING'),
      ),
    )
  const awaitingQc = Number(qcRow?.c ?? 0)
  if (awaitingQc) {
    result.push({
      severity: 'warning',
      code: 'QC',
      message: `${awaitingQc} purchase order(s) waiting for a Quality decision`,
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const [lateRow] = await tx
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.erpPurchaseOrders)
    .where(
      and(
        eq(schema.erpPurchaseOrders.orgId, orgId),
        eq(schema.erpPurchaseOrders.status, 'OPEN'),
        lt(schema.erpPurchaseOrders.expectedDate, today),
      ),
    )
  const overdue = Number(lateRow?.c ?? 0)
  if (overdue) {
    result.push({
      severity: 'warning',
      code: 'LATE',
      message: `${overdue} purchase order(s) past their expected delivery date`,
    })
  }

  return result
}
