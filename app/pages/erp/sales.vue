<script setup lang="ts">
import type { Page, SalesOrder, SalesOrderStatus } from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const session = useErpSession()
const { money, number, date } = useErpFormat()
const { confirm } = useDialogs()
const toast = useToast()

const orders = ref<SalesOrder[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const statusFilter = ref<SalesOrderStatus | ''>('')

const statusOptions: SalesOrderStatus[] = ['OPEN', 'PICKING', 'SHIPPED', 'INVOICED', 'CANCELLED']

const statusLabels: Record<SalesOrderStatus, string> = {
  OPEN: 'Abierto',
  PICKING: 'Preparando',
  SHIPPED: 'Enviado',
  INVOICED: 'Facturado',
  CANCELLED: 'Cancelado',
}

async function load() {
  loading.value = true
  const res = await api.get<Page<SalesOrder>>('salesOrders', {
    query: { limit: 100, ...(statusFilter.value ? { status: statusFilter.value } : {}) },
  })
  if (res.ok) {
    orders.value = res.data.items
    total.value = res.data.meta.total
    error.value = null
  } else {
    error.value = res.error?.message ?? 'No se pudieron cargar los pedidos de venta'
  }
  loading.value = false
}

onMounted(async () => {
  await session.refresh()
  await load()
})

async function advance(order: SalesOrder, status: SalesOrderStatus) {
  const res = await api.patch<SalesOrder>('salesOrderStatus', { status }, { params: { id: order.id } })
  if (res.ok) {
    toast.add({ title: `Estado cambiado a ${statusLabels[status]}`, color: 'success' })
    await load()
  } else {
    toast.add({ title: 'No se pudo cambiar el estado', description: res.error?.message, color: 'error' })
  }
}

async function cancelOrder(order: SalesOrder) {
  const ok = await confirm({
    title: 'Cancelar pedido',
    description: `¿Cancelar el pedido ${order.number}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Cancelar pedido',
    cancelLabel: 'Volver',
    danger: true,
  })
  if (!ok) return

  const res = await api.del<{ message: string }>('salesOrder', { params: { id: order.id } })
  if (res.ok) {
    toast.add({ title: res.data.message, color: 'success' })
    await load()
  } else {
    toast.add({ title: 'No se pudo cancelar', description: res.error?.message, color: 'error' })
  }
}

/** Siguiente acción disponible para un pedido, según el rol. */
function nextAction(order: SalesOrder): { status: SalesOrderStatus; label: string } | null {
  if (order.status === 'OPEN' && session.hasRole('admin', 'logistics')) {
    return { status: 'PICKING', label: 'Preparar' }
  }
  if (order.status === 'PICKING' && session.hasRole('admin', 'logistics')) {
    return { status: 'SHIPPED', label: 'Enviar' }
  }
  if (order.status === 'SHIPPED' && session.hasRole('admin')) {
    return { status: 'INVOICED', label: 'Facturar' }
  }
  return null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Pedidos de venta" :subtitle="`${total} pedidos`">
      <select v-model="statusFilter" class="select select-sm" @change="load()">
        <option value="">Todos</option>
        <option v-for="option in statusOptions" :key="option" :value="option">
          {{ statusLabels[option] }}
        </option>
      </select>
    </PageHeader>

    <p v-if="loading" class="text-sm text-ink/60">Cargando…</p>
    <div v-else-if="error" class="card">
      <div class="card-body items-start gap-3">
        <p class="text-sm text-ink/60">{{ error }}</p>
        <button class="btn btn-sm" type="button" @click="load()">Reintentar</button>
      </div>
    </div>
    <EmptyState v-else-if="!orders.length" title="Sin pedidos de venta" />

    <article v-for="order in orders" :key="order.id" class="card">
      <div class="card-body">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-semibold">{{ order.number }}</span>
            <StatusBadge :status="order.status" />
          </div>
          <span class="text-base font-semibold tabular-nums">{{ money(order.total) }}</span>
        </div>

        <dl class="grid grid-cols-2 gap-3 border-y border-slate-200 py-3 md:grid-cols-4">
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Cliente</dt>
            <dd class="text-sm">{{ order.customer_name ?? order.customerId }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Fecha de pedido</dt>
            <dd class="text-sm">{{ date(order.orderDate) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Fecha de entrega</dt>
            <dd class="text-sm">{{ date(order.deliveryDate) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Líneas</dt>
            <dd class="text-sm">{{ order.lines?.length ?? 0 }}</dd>
          </div>
        </dl>

        <div v-if="order.lines?.length" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Precio</th>
                <th class="text-right">Preparado</th>
                <th class="text-right">Enviado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in order.lines" :key="line.id">
                <td>
                  <span class="font-mono text-xs text-ink/50">{{ line.item_code }}</span>
                  {{ line.item_description }}
                </td>
                <td class="text-right tabular-nums">{{ number(line.quantity) }}</td>
                <td class="text-right tabular-nums">{{ money(line.unitPrice) }}</td>
                <td class="text-right tabular-nums">{{ number(line.qtyPicked) }}</td>
                <td class="text-right tabular-nums">{{ number(line.qtyShipped) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="nextAction(order)"
            class="btn btn-primary btn-sm"
            type="button"
            @click="advance(order, nextAction(order)!.status)"
          >
            {{ nextAction(order)!.label }}
          </button>

          <button
            v-if="order.status === 'PICKING' && session.hasRole('admin', 'logistics')"
            class="btn btn-sm"
            type="button"
            @click="advance(order, 'OPEN')"
          >
            Reabrir
          </button>

          <button
            v-if="session.hasRole('admin') && !['INVOICED', 'CANCELLED'].includes(order.status)"
            class="btn btn-error btn-sm"
            type="button"
            @click="cancelOrder(order)"
          >
            Cancelar
          </button>
        </div>
      </div>
    </article>
  </div>
</template>
