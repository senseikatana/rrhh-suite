/**
 * Tipos compartidos de la capa ERP, adaptados al esquema Drizzle de
 * rrhh-suite (camelCase, IDs string/UUID, scoping por `orgId`).
 *
 * El backend ERP original (Python/Pydantic) exponía snake_case e IDs numéricos.
 * Estos tipos reflejan la API Nitro de `server/api/erp/*`, que es la fuente de
 * verdad. Si la superficie crece, se pueden generar desde los tipos de Drizzle.
 */

export type ErpRole = 'admin' | 'buyer' | 'logistics' | 'quality'

export interface PageMeta {
  total: number
  limit: number
  offset: number
}

export interface Page<T> {
  items: T[]
  meta: PageMeta
}

export interface Kpi {
  key: 'order_accuracy' | 'picks_per_hour' | 'dock_to_stock' | 'inventory_turnover'
  value: number | null
  unit: string
}

export interface Alert {
  severity: 'critical' | 'warning'
  code: string
  message: string
}

export interface DashboardSummary {
  company_code: string
  generated_at: string
  kpis: Kpi[]
  open_sales_orders: number
  open_purchase_orders: number
  orders_awaiting_quality: number
  pending_demand_lines: number
  items_below_minimum: number
  inventory_value: number
  routes_today: number
  alerts: Alert[]
}

export type SalesOrderStatus =
  | 'OPEN'
  | 'PICKING'
  | 'SHIPPED'
  | 'INVOICED'
  | 'CANCELLED'

export interface SalesOrderLine {
  id: string
  orderId: string
  itemId: string
  quantity: string
  unitPrice: string
  qtyPicked: string
  qtyShipped: string
  item_code?: string | null
  item_description?: string | null
}

export interface SalesOrder {
  id: string
  orgId: string
  number: string
  customerId: string
  customer_name?: string | null
  orderDate: string
  deliveryDate: string | null
  status: SalesOrderStatus
  total: string
  notes: string | null
  lines?: SalesOrderLine[]
}

export type PurchaseOrderStatus =
  | 'OPEN'
  | 'RECEIVED'
  | 'QC_PENDING'
  | 'QC_APPROVED'
  | 'REJECTED'
  | 'CLOSED'

export type QualityStatus = 'PENDING' | 'PASSED' | 'FAILED'

export interface PurchaseOrderLine {
  id: string
  orderId: string
  itemId: string
  quantity: string
  unitCost: string
  qtyReceived: string
  qcStatus: QualityStatus
  stockPosted: boolean
  item_code?: string | null
  item_description?: string | null
}

export interface PurchaseOrder {
  id: string
  orgId: string
  number: string
  vendorId: string
  vendor_name?: string | null
  orderDate: string
  expectedDate: string | null
  status: PurchaseOrderStatus
  total: string
  lines?: PurchaseOrderLine[]
}

export interface Item {
  id: string
  orgId: string
  code: string
  description: string
  unit: string
  unitCost: string
  unitPrice: string
  stock: string
  minStock: string
  location: string
  category: string | null
}

export interface Customer {
  id: string
  orgId: string
  code: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string
  taxId: string | null
}

export interface Vendor {
  id: string
  orgId: string
  code: string
  name: string
  email: string | null
  phone: string | null
  leadTimeDays: number
  qualityRating: number
}

export type DemandSource = 'SALES_ORDER' | 'MIN_STOCK' | 'FORECAST'
export type DemandAction = 'PENDING' | 'ORDERED' | 'IGNORED'

export interface DemandLine {
  id: string
  orgId: string
  itemId: string
  itemCode?: string | null
  itemDescription?: string | null
  requiredDate: string
  quantityNeeded: string
  source: DemandSource
  action: DemandAction
}

export type RouteStatus = 'PLANNED' | 'IN_TRANSIT' | 'DELIVERED'

export interface ErpRoute {
  id: string
  orgId: string
  code: string
  carrier: string
  date: string
  status: RouteStatus
  stops: number
}

export interface ActivityEvent {
  id: string
  occurredAt: string
  actorUsername: string
  entity: string
  entityId: string | null
  action: string
  summary: string | null
  payload: Record<string, unknown> | null
}
