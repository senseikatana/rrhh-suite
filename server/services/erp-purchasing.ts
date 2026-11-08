import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import * as schema from '../database/schema'
import type { ErpActor, ErpRole } from '../utils/erp'
import { recordActivity } from './erp-activity'

/**
 * Flujos de pedidos de compra: recepción y puerta de control de calidad
 * (migrado de `services/purchasing_service.py`).
 *
 * El inventario solo sube con una aprobación de Calidad, nunca con la recepción
 * en sí. Esa es la razón de ser de la puerta QC: la mercancía queda en
 * `QC_PENDING` e invisible al stock hasta que Calidad la acepta.
 *
 * La aprobación es idempotente. Reaprobar una línea ya aprobada no hace nada,
 * así un doble clic no infla el inventario.
 */

export type PurchaseOrderStatus =
  | 'OPEN'
  | 'RECEIVED'
  | 'QC_PENDING'
  | 'QC_APPROVED'
  | 'REJECTED'
  | 'CLOSED'
export type QualityStatus = 'PENDING' | 'PASSED' | 'FAILED'

/** Roles que pueden llevar la orden a cada estado. */
const ROLE_PERMISSIONS: Record<PurchaseOrderStatus, ErpRole[]> = {
  OPEN: ['admin', 'buyer'],
  RECEIVED: ['admin', 'logistics'],
  QC_PENDING: ['admin', 'quality'],
  QC_APPROVED: ['admin'],
  REJECTED: ['admin', 'buyer'],
  CLOSED: ['admin'],
}

/** Estados desde los que se acepta una decisión de Calidad. */
const QC_DECISION_STATES: PurchaseOrderStatus[] = ['QC_PENDING', 'RECEIVED']

export class WorkflowError extends Error {}

export function assertAllowed(status: PurchaseOrderStatus, role: ErpRole) {
  const permitted = ROLE_PERMISSIONS[status] ?? []
  if (!permitted.includes(role)) {
    const allowed = permitted.slice().sort().join(', ')
    throw new WorkflowError(
      `Role '${role}' cannot set status ${status}. Allowed: ${allowed}`,
    )
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Comprueba que una fila pertenece a la organización. Las FKs validan
 * existencia, no pertenencia: sin este check un usuario puede referenciar
 * proveedores/artículos de OTRO tenant y, al aprobar QC, mover stock ajeno.
 */
async function assertBelongsToOrg(
  tx: Tx,
  table: typeof schema.erpItems | typeof schema.erpVendors,
  id: string,
  orgId: string,
  label: string,
) {
  const [row] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.orgId, orgId)))
    .limit(1)
  if (!row) {
    throw new WorkflowError(`${label} '${id}' does not belong to this organization`)
  }
}

export async function nextNumber(tx: Tx, orgId: string, year: number, prefix = 'PO') {
  // Advisory lock transaccional por (org, año): serializa la generación de
  // números para que dos createOrder concurrentes no calculen el mismo
  // correlativo (count(*) es una carrera → unique violation → 500).
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`po:${orgId}:${year}`}::text))`,
  )
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.erpPurchaseOrders)
    .where(
      and(
        eq(schema.erpPurchaseOrders.orgId, orgId),
        sql`to_char(${schema.erpPurchaseOrders.orderDate}, 'YYYY') = ${String(year)}`,
      ),
    )
  return `${prefix}-${year}-${((row?.count ?? 0) + 1).toString().padStart(4, '0')}`
}

export interface PurchaseOrderLineInput {
  itemId: string
  quantity: number
  unitCost: number
}

export interface PurchaseOrderCreateInput {
  vendorId: string
  expectedDate?: string | null
  lines: PurchaseOrderLineInput[]
}

export async function createOrder(
  tx: Tx,
  orgId: string,
  actor: ErpActor,
  payload: PurchaseOrderCreateInput,
) {
  assertAllowed('OPEN', actor.role)

  // Validar pertenencia al tenant: el proveedor y cada artículo deben ser de
  // esta organización (las FKs solo garantizan existencia, no pertenencia).
  await assertBelongsToOrg(tx, schema.erpVendors, payload.vendorId, orgId, 'Vendor')
  for (const line of payload.lines) {
    await assertBelongsToOrg(tx, schema.erpItems, line.itemId, orgId, 'Item')
    if (!(Number(line.quantity) > 0)) {
      throw new WorkflowError('Line quantity must be greater than zero')
    }
    if (!(Number(line.unitCost) >= 0)) {
      throw new WorkflowError('Line unit cost cannot be negative')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const number = await nextNumber(tx, orgId, new Date().getFullYear())
  const total = payload.lines.reduce(
    (acc, l) => acc + Number(l.quantity) * Number(l.unitCost),
    0,
  )

  const [order] = await tx
    .insert(schema.erpPurchaseOrders)
    .values({
      id: crypto.randomUUID(),
      orgId,
      number,
      vendorId: payload.vendorId,
      orderDate: today,
      expectedDate: payload.expectedDate ?? null,
      status: 'OPEN',
      total: total.toFixed(2),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (payload.lines.length) {
    await tx.insert(schema.erpPurchaseOrderLines).values(
      payload.lines.map((line) => ({
        id: crypto.randomUUID(),
        orderId: order!.id,
        itemId: line.itemId,
        quantity: Number(line.quantity).toFixed(3),
        unitCost: Number(line.unitCost).toFixed(2),
      })),
    )
  }

  await recordActivity(tx, {
    orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    entity: 'purchase_order',
    action: 'created',
    entityId: order!.id,
    summary: `Created purchase order ${number}`,
    payload: { total: total.toFixed(2), lines: payload.lines.length },
  })

  return order!
}

export interface ReceiptLineInput {
  lineId: string
  quantityReceived: number
}

export interface ReceiptRequest {
  reference?: string | null
  lines?: ReceiptLineInput[] | null
}

/** Registra la recepción de mercancía contra un pedido. */
export async function receive(
  tx: Tx,
  orgId: string,
  actor: ErpActor,
  order: typeof schema.erpPurchaseOrders.$inferSelect,
  lines: (typeof schema.erpPurchaseOrderLines.$inferSelect)[],
  payload: ReceiptRequest,
) {
  const status = order.status as PurchaseOrderStatus
  if (status !== 'OPEN' && status !== 'RECEIVED') {
    throw new WorkflowError(`Cannot receive goods on an order in status ${status}`)
  }
  assertAllowed('RECEIVED', actor.role)

  const requested = new Map<string, string>()
  for (const l of payload.lines ?? []) {
    requested.set(l.lineId, Number(l.quantityReceived).toFixed(3))
  }

  for (const line of lines) {
    const quantity = requested.get(line.id) ?? line.quantity
    await tx
      .update(schema.erpPurchaseOrderLines)
      .set({ qtyReceived: quantity, qcStatus: 'PENDING' })
      .where(eq(schema.erpPurchaseOrderLines.id, line.id))
  }

  // Calidad es una puerta separada. Cuando la empresa la exige, la recepción
  // mueve el pedido directo a QC_PENDING para que aparezca en la cola de Calidad.
  const [org] = await tx
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)

  const nextStatus: PurchaseOrderStatus =
    !org || org.qualityCheckRequired ? 'QC_PENDING' : 'RECEIVED'

  await tx
    .update(schema.erpPurchaseOrders)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(schema.erpPurchaseOrders.id, order.id))

  await recordActivity(tx, {
    orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    entity: 'purchase_order',
    action: 'received',
    entityId: order.id,
    summary: `Goods received on ${order.number}`,
    payload: {
      lines: Object.fromEntries([...requested].map(([k, v]) => [k, v])),
      reference: payload.reference ?? null,
      next_status: nextStatus,
    },
  })

  return { ...order, status: nextStatus, updatedAt: new Date() }
}

export interface QualityLineInput {
  lineId: string
  status: QualityStatus
}

export interface QualityDecisionRequest {
  passed: boolean
  note?: string | null
  lines?: QualityLineInput[] | null
}

/** Aplica una decisión de Calidad y, al aprobar, registra el movimiento de stock. */
export async function decideQuality(
  tx: Tx,
  orgId: string,
  actor: ErpActor,
  order: typeof schema.erpPurchaseOrders.$inferSelect,
  lines: (typeof schema.erpPurchaseOrderLines.$inferSelect)[],
  payload: QualityDecisionRequest,
) {
  const status = order.status as PurchaseOrderStatus
  if (!QC_DECISION_STATES.includes(status)) {
    throw new WorkflowError(
      `Quality can only decide on orders in QC_PENDING or RECEIVED, not ${status}`,
    )
  }
  assertAllowed('QC_PENDING', actor.role)

  const overrides = new Map<string, QualityStatus>()
  for (const l of payload.lines ?? []) overrides.set(l.lineId, l.status)

  const stockMovements: { item: string; qty: string }[] = []
  const rejectedLines: string[] = []

  for (const line of lines) {
    const decision = overrides.get(line.id) ?? (payload.passed ? 'PASSED' : 'FAILED')

    if (decision !== 'PASSED') {
      rejectedLines.push(line.id)
      await tx
        .update(schema.erpPurchaseOrderLines)
        .set({ qcStatus: decision })
        .where(eq(schema.erpPurchaseOrderLines.id, line.id))
      continue
    }

    // Publicar stock solo una vez por línea. El update condicional
    // (`stockPosted = false`) es la guardia atómica: dos aprobaciones
    // concurrentes no pueden publicar dos veces la misma línea.
    const [posted] = await tx
      .update(schema.erpPurchaseOrderLines)
      .set({ stockPosted: true, qcStatus: 'PASSED' })
      .where(
        and(
          eq(schema.erpPurchaseOrderLines.id, line.id),
          eq(schema.erpPurchaseOrderLines.stockPosted, false),
        ),
      )
      .returning()

    if (posted) {
      // Incremento atómico en SQL: evita el read-then-write que pierde updates
      // ante aprobaciones concurrentes. Se publica la cantidad RECIBIDA.
      const received = Number(line.qtyReceived)
      const [item] = await tx
        .update(schema.erpItems)
        .set({
          stock: sql`${schema.erpItems.stock} + ${received}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.erpItems.id, line.itemId))
        .returning({ code: schema.erpItems.code })
      if (item) {
        stockMovements.push({ item: item.code, qty: String(line.qtyReceived) })
      }
    } else {
      await tx
        .update(schema.erpPurchaseOrderLines)
        .set({ qcStatus: 'PASSED' })
        .where(eq(schema.erpPurchaseOrderLines.id, line.id))
    }
  }

  // Una aprobación solo se sostiene cuando todas las líneas pasaron.
  const allPassed = rejectedLines.length === 0
  const nextStatus: PurchaseOrderStatus = allPassed ? 'QC_APPROVED' : 'OPEN'

  await tx
    .update(schema.erpPurchaseOrders)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(schema.erpPurchaseOrders.id, order.id))

  const action = allPassed ? 'qc_approved' : 'qc_rejected'
  const summary = allPassed
    ? `Quality approved ${order.number}`
    : `Quality rejected ${order.number}`

  await recordActivity(tx, {
    orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    entity: 'purchase_order',
    action,
    entityId: order.id,
    summary,
    payload: {
      note: payload.note ?? null,
      stock_movements: stockMovements,
      rejected_lines: rejectedLines,
      at: new Date().toISOString(),
    },
  })

  return { ...order, status: nextStatus, updatedAt: new Date() }
}
