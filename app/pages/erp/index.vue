<script setup lang="ts">
import type {
  ActivityEvent,
  Alert,
  DashboardSummary,
  DemandLine,
  ErpRoute,
  Item,
} from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const { money, number, dateTime } = useErpFormat()

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null

  const res = await api.get<DashboardSummary>('dashboardSummary')
  if (res.ok) {
    summary.value = res.data
  } else {
    error.value = res.error?.message ?? 'No se pudo cargar el panel'
  }
  loading.value = false
}

onMounted(load)

function stockRatio(item: { stock: string; minStock: string }): number {
  const min = Number(item.minStock)
  if (!min) return 100
  return Math.min(100, Math.round((Number(item.stock) / min) * 100))
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Panel ERP" subtitle="Indicadores y estado operativo" />

    <p v-if="loading" class="text-sm text-ink/60">Cargando…</p>

    <div v-else-if="error" class="card">
      <div class="card-body items-start gap-3">
        <p class="text-sm text-ink/60">{{ error }}</p>
        <button class="btn btn-sm" type="button" @click="load()">Reintentar</button>
      </div>
    </div>

    <template v-else-if="summary">
      <!-- KPIs medidos: cada valor proviene del log de actividad. -->
      <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <erp-KpiCard v-for="kpi in summary.kpis" :key="kpi.key" :kpi="kpi" />
      </section>

      <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pedidos de venta abiertos" :value="number(summary.open_sales_orders)" />
        <StatCard label="Pedidos de compra abiertos" :value="number(summary.open_purchase_orders)" />
        <StatCard label="A la espera de calidad" :value="number(summary.orders_awaiting_quality)" />
        <StatCard label="Líneas de demanda pendientes" :value="number(summary.pending_demand_lines)" />
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Artículos bajo mínimo" :value="number(summary.items_below_minimum)" />
        <StatCard label="Valor de inventario" :value="money(summary.inventory_value)" />
        <StatCard label="Rutas hoy" :value="number(summary.routes_today)" />
      </section>

      <!-- Alertas operativas -->
      <section class="card">
        <div class="card-body">
          <h2 class="text-lg font-semibold">Alertas</h2>
          <EmptyState v-if="!summary.alerts?.length" title="Sin alertas" />
          <ul v-else class="flex flex-col gap-2">
            <li v-for="(alert, index) in summary.alerts" :key="index">
              <div
                class="alert alert-soft text-sm"
                :class="alert.severity === 'critical' ? 'alert-error' : 'alert-warning'"
              >
                <span class="font-mono font-semibold">{{ alert.code }}</span>
                <span>{{ alert.message }}</span>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
