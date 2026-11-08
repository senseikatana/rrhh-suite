import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import * as schema from '../database/schema'
import type { ErpActor, ErpRole } from '../utils/erp'
import { recordActivity } from './erp-activity'

/**
 * Flujos de pedidos de venta (migrado de `services/sales_service.py`).
 *
 * El grafo de transiciones se valida aquí, no en el handler de la petición y
 * nunca en el cliente. Un rol puede intentar una acción; el servicio decide si
 * el estado actual la permite.
 */

export type SalesOrderStatus = 'OPEN' | 'PICKING' | 'SHIPPED' | 'INVOICED' | 'CANCELLED'

/** Transiciones permitidas. Cualquier salto no listado aquí se rechaza. */
const ALLOWED_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  OPEN: ['PICKING', 'CANCELLED'],
  PICKING: ['SHIPPED', 'OPEN'],
  SHIPPED: ['INVOICED'],
  INVOICED: [],
  CANCELLED: [],
}

/** Roles que pueden mover un pedido a cada estado.
 *  Purchasing está ausente a propósito: compras crea pedidos, logística los sirve. */
const ROLE_PERMISSIONS: Record<SalesOrderStatus, ErpRole[]> = {
  OPEN: ['admin'],
  PICKING: ['admin', 'logistics'],
  SHIPPED: ['admin', 'logistics'],
  INVOICED: ['admin'],
  CANCELLED: ['admin'],
}

export class TransitionError extends Error {}

/** Comprueba una transición contra el grafo y el rol del actor. */
export function canTransition(
  orderStatus: SalesOrderStatus,
  target: SalesOrderStatus,
  role: ErpRole,
): { allowed: boolean; reason: string } {
  if (!ALLOWED_TRANSITIONS[orderStatus]?.includes(target)) {
    return {
      allowed: false,
      reason: `Cannot move an order from ${orderStatus} to ${target}`,
    }
  }
  if (!ROLE_PERMISSIONS[target]?.includes(role)) {
    const allowedRoles = (ROLE_PERMISSIONS[target] ?? []).slice().sort().join(', ')
    return {
      allowed: false,
      reason: `Role '${role}' cannot set status ${target}. Allowed: ${allowedRoles}`,
    }
  }
  return { allowed: true, reason: '' }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Comprueba que una fila pertenece a la organización. Las FKs validan
 * existencia, no pertenencia: sin este check un usuario puede referenciar
 * clientes/artículos/proveedores de OTRO tenant.
 */
async function assertBelongsToOrg(
  tx: Tx,
  table: typeof schema.erpCustomers | typeof schema.erpItems | typeof schema.erpVendors,
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
    throw new TransitionError(`${label} '${id}' does not belong to this organization`)
  }
}

/** Siguiente número correlativo de pedido por organización y año. */
export async function nextNumber(tx: Tx, orgId: string, year: number, prefix = 'SO') {
  // Advisory lock transaccional por (org, año): serializa la generación de
  // números para que dos createOrder concurrentes no calculen el mismo
  // correlativo (count(*) es una carrera → unique violation → 500).
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`so:${orgId}:${year}`}::text))`,
  )
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.erpSalesOrders)
    .where(
      and(
        eq(schema.erpSalesOrders.orgId, orgId),
        sql`to_char(${schema.erpSalesOrders.orderDate}, 'YYYY') = ${String(year)}`,
      ),
    )
  return `${prefix}-${year}-${((row?.count ?? 0) + 1).toString().padStart(4, '0')}`
}

export interface SalesOrderLineInput {
  itemId: string
  quantity: number
  unitPrice: number
}

export interface SalesOrderCreateInput {
  customerId: string
  deliveryDate?: string | null
  notes?: string | null
  lines: SalesOrderLineInput[]
}

function sumLines(lines: { quantity: number; unitPrice: number }[]) {
  return lines.reduce((acc, l) => acc + Number(l.quantity) * Number(l.unitPrice), 0)
}

/** Crea un pedido de venta con sus líneas y registra el evento. */
export async function createOrder(
  tx: Tx,
  orgId: string,
  actor: ErpActor,
  payload: SalesOrderCreateInput,
) {
  if (!['admin', 'buyer'].includes(actor.role)) {
    throw new TransitionError(`Role '${actor.role}' cannot create sales orders`)
  }

  // Validar pertenencia al tenant: el cliente y cada artículo deben ser de esta
  // organización (las FKs solo garantizan existencia, no pertenencia).
  await assertBelongsToOrg(tx, schema.erpCustomers, payload.customerId, orgId, 'Customer')
  for (const line of payload.lines) {
    await assertBelongsToOrg(tx, schema.erpItems, line.itemId, orgId, 'Item')
    if (!(Number(line.quantity) > 0)) {
      throw new TransitionError('Line quantity must be greater than zero')
    }
    if (!(Number(line.unitPrice) >= 0)) {
      throw new TransitionError('Line unit price cannot be negative')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const number = await nextNumber(tx, orgId, new Date().getFullYear())
  const total = sumLines(payload.lines)

  const [order] = await tx
    .insert(schema.erpSalesOrders)
    .values({
      id: crypto.randomUUID(),
      orgId,
      number,
      customerId: payload.customerId,
      orderDate: today,
      deliveryDate: payload.deliveryDate ?? null,
      status: 'OPEN',
      total: total.toFixed(2),
      notes: payload.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (payload.lines.length) {
    await tx.insert(schema.erpSalesOrderLines).values(
      payload.lines.map((line) => ({
        id: crypto.randomUUID(),
        orderId: order!.id,
        itemId: line.itemId,
        quantity: Number(line.quantity).toFixed(3),
        unitPrice: Number(line.unitPrice).toFixed(2),
      })),
    )
  }

  await recordActivity(tx, {
    orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    entity: 'sales_order',
    action: 'created',
    entityId: order!.id,
    summary: `Created sales order ${number}`,
    payload: { total: total.toFixed(2), lines: payload.lines.length },
  })

  return order!
}

export interface StatusChangeInput {
  status: SalesOrderStatus
  reason?: string | null
}

/** Mueve un pedido a un nuevo estado aplicando los efectos de ese estado. */
export async function changeStatus(
  tx: Tx,
  orgId: string,
  actor: ErpActor,
  order: typeof schema.erpSalesOrders.$inferSelect,
  lines: (typeof schema.erpSalesOrderLines.$inferSelect)[],
  change: StatusChangeInput,
) {
  const target = change.status
  const { allowed, reason } = canTransition(order.status as SalesOrderStatus, target, actor.role)
  if (!allowed) throw new TransitionError(reason)

  const previous = order.status as SalesOrderStatus

  if (target === 'PICKING') {
    for (const line of lines) {
      if (Number(line.qtyPicked) < Number(line.quantity)) {
        await tx
          .update(schema.erpSalesOrderLines)
          .set({ qtyPicked: line.quantity })
          .where(eq(schema.erpSalesOrderLines.id, line.id))
      }
    }
  } else if (target === 'SHIPPED') {
    for (const line of lines) {
      await tx
        .update(schema.erpSalesOrderLines)
        .set({ qtyShipped: line.quantity })
        .where(eq(schema.erpSalesOrderLines.id, line.id))
    }
  } else if (target === 'OPEN' && previous === 'PICKING') {
    // Reabierto para retrabajo: resetea el progreso de picking.
    for (const line of lines) {
      await tx
        .update(schema.erpSalesOrderLines)
        .set({ qtyPicked: '0.000' })
        .where(eq(schema.erpSalesOrderLines.id, line.id))
    }
  }

  await tx
    .update(schema.erpSalesOrders)
    .set({ status: target, updatedAt: new Date() })
    .where(eq(schema.erpSalesOrders.id, order.id))

  await recordActivity(tx, {
    orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    entity: 'sales_order',
    action: 'status_changed',
    entityId: order.id,
    summary: `${previous} -> ${target}`,
    payload: {
      from: previous,
      to: target,
      reason: change.reason ?? null,
      at: new Date().toISOString(),
    },
  })

  return { ...order, status: target, updatedAt: new Date() }
}

export async function getOrderLines(tx: Tx, orderId: string) {
  return tx
    .select()
    .from(schema.erpSalesOrderLines)
    .where(eq(schema.erpSalesOrderLines.orderId, orderId))
}
