<script setup lang="ts">
import type { BalanceResponse, LeaveRequestRow } from '~/types/api'
import type { DashboardSummary } from '~/types/erp'

/**
 * Hub de herramientas: bento grid con todos los módulos de la suite.
 *
 * Mezcla piezas de acceso directo (RRHH y ERP) con piezas de dato vivo. La
 * asimetría de los tamaños (`hero`, `wide`, `tall`, `sm`) es la que da el
 * carácter de bento: no es una retícula uniforme de tarjetas iguales.
 */
definePageMeta({ layout: 'default' })

const { state, isManager, displayName } = useSession()
const erpSession = useErpSession()
const requestFetch = useRequestFetch()
const year = new Date().getFullYear()

// --- Datos vivos de RRHH ---
const { data: balance } = await useAsyncData<BalanceResponse>('tools-balance', () =>
  requestFetch('/api/leave/balance', { query: { year } }),
)
const { data: pending } = await useAsyncData<LeaveRequestRow[]>('tools-pending', () =>
  isManager.value
    ? requestFetch('/api/leave/requests', { query: { scope: 'team', status: 'pending', year } })
    : Promise.resolve([]),
)

// --- Datos vivos de ERP (solo si el usuario tiene rol ERP) ---
const erpSummary = ref<DashboardSummary | null>(null)
onMounted(async () => {
  await erpSession.refresh()
  if (erpSession.role.value) {
    const api = useErpApi()
    const res = await api.get<DashboardSummary>('dashboardSummary')
    if (res.ok) erpSummary.value = res.data
  }
})

const vacation = computed(() => balance.value?.balances.find((item) => item.code === 'VAC'))

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 13) return 'Buenos días'
  if (hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
})

// Accesos directos de RRHH
const rrhhTools = computed(() => [
  {
    title: 'Vacaciones',
    description: 'Pide días y revisa tu saldo',
    to: '/vacaciones',
    icon: 'i-lucide-palmtree',
    tone: 'emerald' as const,
  },
  {
    title: 'Calendario',
    description: 'Vista anual del equipo por departamento',
    to: '/vacaciones/calendario',
    icon: 'i-lucide-calendar-days',
    tone: 'sky' as const,
  },
  {
    title: 'Fichaje',
    description: 'Entrada, salida y horas trabajadas',
    to: '/fichaje',
    icon: 'i-lucide-clock',
    tone: 'violet' as const,
  },
  ...(isManager.value
    ? [
        {
          title: 'Aprobaciones',
          description: 'Solicitudes pendientes del equipo',
          to: '/vacaciones/aprobaciones',
          icon: 'i-lucide-check-check',
          tone: 'amber' as const,
        },
        {
          title: 'Empleados',
          description: 'Plantilla, importación y exportación',
          to: '/empleados',
          icon: 'i-lucide-users',
          tone: 'sky' as const,
        },
      ]
    : []),
  {
    title: 'Gastos',
    description: 'Partes y reembolsos',
    to: '/gastos',
    icon: 'i-lucide-receipt',
    tone: 'rose' as const,
    badge: 'F3',
  },
  {
    title: 'Nóminas',
    description: 'Períodos y recibos',
    to: '/nominas',
    icon: 'i-lucide-banknote',
    tone: 'emerald' as const,
    badge: 'F3',
  },
  {
    title: 'Reclutamiento',
    description: 'Ofertas y candidatos',
    to: '/reclutamiento',
    icon: 'i-lucide-user-plus',
    tone: 'sky' as const,
    badge: 'F4',
  },
  {
    title: 'Denuncias',
    description: 'Canal de denuncias interno',
    to: '/denuncias',
    icon: 'i-lucide-shield-check',
    tone: 'violet' as const,
    badge: 'F4',
  },
])

// Accesos directos de ERP (filtrados por rol ERP)
const erpTools = computed(() => {
  const nav = erpSession.navigation.value
  const iconByKey: Record<string, string> = {
    sales: 'i-lucide-shopping-cart',
    purchases: 'i-lucide-shopping-bag',
    warehouse: 'i-lucide-warehouse',
    demand: 'i-lucide-line-chart',
    routes: 'i-lucide-truck',
    activity: 'i-lucide-activity',
  }
  const descByKey: Record<string, string> = {
    sales: 'Pedidos y flujo de preparación',
    purchases: 'Recepción y control de calidad',
    warehouse: 'Inventario y ajustes de stock',
    demand: 'Hoja de necesidades de compra',
    routes: 'Planificación de transporte',
    activity: 'Registro de cambios y auditoría',
  }
  return nav
    .filter((entry) => entry.key !== 'dashboard')
    .map((entry) => ({
      title: entry.label,
      description: descByKey[entry.key] ?? '',
      to: entry.to,
      icon: iconByKey[entry.key] ?? 'i-lucide-box',
    }))
})

const hasErp = computed(() => erpSession.role.value !== null)
</script>

<template>
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
      <p class="text-sm text-slate-400">
        {{ formatDate(new Date()) }} · {{ state?.organization.name }}
      </p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {{ greeting }}, {{ displayName }}
      </h1>
      <p class="mt-2 max-w-xl text-sm text-slate-400">
        Todas tus herramientas en un solo lugar. RRHH
        <template v-if="hasErp"> y operaciones ERP</template>, a un clic.
      </p>
    </div>

    <!-- BENTO GRID -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Pieza hero: vacaciones -->
      <BentoTile
        size="hero"
        accent
        title="Vacaciones disponibles"
        :value="vacation?.availableDays ?? 0"
        :hint="`de ${vacation?.totalDays ?? 0} días en ${year}`"
        icon="i-lucide-palmtree"
        to="/vacaciones"
      />

      <!-- Fichaje rápido -->
      <BentoTile
        size="wide"
        title="Fichaje"
        description="Registra tu entrada o salida del turno de hoy"
        icon="i-lucide-clock"
        tone="violet"
        to="/fichaje"
      />

      <!-- Pendientes -->
      <BentoTile
        title="Pendientes"
        :value="pending?.length ?? 0"
        :hint="isManager ? 'solicitudes por aprobar' : 'tus solicitudes abiertas'"
        icon="i-lucide-check-check"
        tone="amber"
        :to="isManager ? '/vacaciones/aprobaciones' : '/vacaciones'"
      />

      <!-- KPIs ERP (si hay rol) -->
      <template v-if="hasErp">
        <BentoTile
          title="Pedidos de venta"
          :value="erpSummary?.open_sales_orders ?? 0"
          hint="abiertos"
          icon="i-lucide-shopping-cart"
          tone="sky"
          to="/erp/sales"
        />
        <BentoTile
          title="En calidad"
          :value="erpSummary?.orders_awaiting_quality ?? 0"
          hint="compras por revisar"
          icon="i-lucide-shopping-bag"
          tone="rose"
          to="/erp/purchases"
        />
        <BentoTile
          title="Inventario"
          :value="erpSummary?.items_below_minimum ?? 0"
          hint="artículos bajo mínimo"
          icon="i-lucide-warehouse"
          tone="emerald"
          to="/erp/warehouse"
        />
      </template>
    </div>

    <!-- Herramientas de RRHH -->
    <section>
      <h2 class="text-sm font-semibold text-slate-900">Gestión de personas</h2>
      <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BentoTile
          v-for="tool in rrhhTools"
          :key="tool.to"
          :title="tool.title"
          :description="tool.description"
          :icon="tool.icon"
          :tone="tool.tone"
          :badge="tool.badge"
          :to="tool.to"
        />
      </div>
    </section>

    <!-- Herramientas de ERP -->
    <section v-if="hasErp && erpTools.length">
      <h2 class="text-sm font-semibold text-slate-900">Operaciones ERP</h2>
      <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BentoTile
          v-for="tool in erpTools"
          :key="tool.to"
          :title="tool.title"
          :description="tool.description"
          :icon="tool.icon"
          tone="slate"
          :to="tool.to"
        />
      </div>
    </section>

    <!-- Pie de acceso completo -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <BentoTile
        size="wide"
        title="Panel ERP"
        description="Indicadores, alertas y estado operativo del negocio"
        icon="i-lucide-layout-grid"
        tone="sky"
        to="/erp"
      />
      <BentoTile
        size="wide"
        title="Mi cuenta"
        description="Perfil, preferencias y configuración personal"
        icon="i-lucide-settings"
        tone="slate"
        to="/cuenta"
      />
    </div>
  </div>
</template>
