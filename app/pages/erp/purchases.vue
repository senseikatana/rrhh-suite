<script setup lang="ts">
import type { Page, PurchaseOrder } from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const session = useErpSession()
const { money, number, date } = useErpFormat()
const { confirm, prompt } = useDialogs()
const toast = useToast()

const tab = ref<'orders' | 'quality'>('orders')
const orders = ref<PurchaseOrder[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  // La cola de calidad son los pedidos con status QC_PENDING.
  const res = await api.get<Page<PurchaseOrder>>('purchaseOrders', {
    query: {
      limit: 100,
      ...(tab.value === 'quality' ? { status: 'QC_PENDING' } : {}),
    },
  })
  if (res.ok) {
    orders.value = res.data.items
    total.value = res.data.meta.total
    error.value = null
  } else {
    error.value = res.error?.message ?? 'No se pudieron cargar los pedidos de compra'
  }
  loading.value = false
}

onMounted(async () => {
  await session.refresh()
  await load()
})

async function receive(order: PurchaseOrder) {
  // Omitir `lines` recibe la cantidad pedida completa en un paso.
  const res = await api.post<PurchaseOrder>('purchaseReceive', {}, { params: { id: order.id } })
  if (res.ok) {
    toast.add({ title: 'Mercancía recibida', description: `Pedido ${order.number}`, color: 'success' })
    await load()
  } else {
    toast.add({ title: 'No se pudo registrar la recepción', description: res.error?.message, color: 'error' })
  }
}

async function decide(order: PurchaseOrder, passed: boolean) {
  let note = ''
  if (!passed) {
    // El rechazo exige un motivo: modal real, no window.prompt.
    const input = await prompt({
      title: 'Rechazar por calidad',
      description: `Pedido ${order.number}. Indica el motivo del rechazo.`,
      label: 'Motivo del rechazo',
      placeholder: 'Ej.: mercancía dañada, cantidad incorrecta…',
      multiline: true,
      required: true,
      confirmLabel: 'Rechazar',
      danger: true,
    })
    if (input === null) return // cancelado
    note = input
  }

  const res = await api.post<PurchaseOrder>(
    'purchaseQuality',
    { passed, note },
    { params: { id: order.id } },
  )
  if (res.ok) {
    toast.add({
      title: passed ? 'Calidad aprobada' : 'Calidad rechazada',
      description: `Pedido ${order.number}`,
      color: passed ? 'success' : 'warning',
    })
    await load()
  } else {
    toast.add({ title: 'No se pudo registrar la decisión', description: res.error?.message, color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Pedidos de compra" :subtitle="`${total} pedidos`">
      <div class="tabs tabs-bordered" role="tablist">
        <button
          class="tab"
          :class="{ 'tab-active': tab === 'orders' }"
          role="tab"
          type="button"
          :aria-selected="tab === 'orders'"
          @click="tab = 'orders'; load()"
        >
          Pedidos
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': tab === 'quality' }"
          role="tab"
          type="button"
          :aria-selected="tab === 'quality'"
          @click="tab = 'quality'; load()"
        >
          Cola de calidad
        </button>
      </div>
    </PageHeader>

    <p v-if="loading" class="text-sm text-ink/60">Cargando…</p>
    <div v-else-if="error" class="card">
      <div class="card-body items-start gap-3">
        <p class="text-sm text-ink/60">{{ error }}</p>
        <button class="btn btn-sm" type="button" @click="load()">Reintentar</button>
      </div>
    </div>
    <EmptyState
      v-else-if="!orders.length"
      :title="tab === 'quality' ? 'Sin pedidos en calidad' : 'Sin pedidos de compra'"
    />

    <article v-for="order in orders" :key="order.id" class="card">
      <div class="card-body">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-semibold">{{ order.number }}</span>
            <erp-ErpStatusBadge :status="order.status" />
          </div>
          <span class="text-base font-semibold tabular-nums">{{ money(order.total) }}</span>
        </div>

        <dl class="grid grid-cols-2 gap-3 border-y border-slate-200 py-3 md:grid-cols-3">
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Proveedor</dt>
            <dd class="text-sm">{{ order.vendor_name ?? order.vendorId }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Fecha de pedido</dt>
            <dd class="text-sm">{{ date(order.orderDate) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-ink/50">Fecha prevista</dt>
            <dd class="text-sm">{{ date(order.expectedDate) }}</dd>
          </div>
        </dl>

        <div v-if="order.lines?.length" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Recibido</th>
                <th class="text-right">Coste</th>
                <th>Calidad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in order.lines" :key="line.id">
                <td>
                  <span class="font-mono text-xs text-ink/50">{{ line.item_code }}</span>
                  {{ line.item_description }}
                </td>
                <td class="text-right tabular-nums">{{ number(line.quantity) }}</td>
                <td class="text-right tabular-nums">{{ number(line.qtyReceived) }}</td>
                <td class="text-right tabular-nums">{{ money(line.unitCost) }}</td>
                <td><erp-ErpStatusBadge :status="line.qcStatus" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="session.hasRole('admin', 'logistics') && ['OPEN', 'RECEIVED'].includes(order.status)"
            class="btn btn-primary btn-sm"
            type="button"
            @click="receive(order)"
          >
            Recibir
          </button>

          <template v-if="session.hasRole('admin', 'quality') && order.status === 'QC_PENDING'">
            <button class="btn btn-primary btn-sm" type="button" @click="decide(order, true)">
              Aprobar
            </button>
            <button class="btn btn-error btn-sm" type="button" @click="decide(order, false)">
              Rechazar
            </button>
          </template>

          <p
            v-if="order.status === 'QC_PENDING' && !session.hasRole('admin', 'quality')"
            class="text-xs text-ink/50"
          >
            Esperando decisión de calidad
          </p>
        </div>
      </div>
    </article>
  </div>
</template>
