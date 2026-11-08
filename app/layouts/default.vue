<script setup lang="ts">
import type { NavSection } from '~/types/nav'

const { state, isAdmin, isManager, displayName } = useSession()
const erpSession = useErpSession()
const route = useRoute()

/** Iconos por módulo ERP, para la sección del sidebar. */
const ERP_NAV_ICONS: Record<string, string> = {
  sales: 'i-lucide-shopping-cart',
  purchases: 'i-lucide-shopping-bag',
  warehouse: 'i-lucide-warehouse',
  demand: 'i-lucide-line-chart',
  routes: 'i-lucide-truck',
  activity: 'i-lucide-activity',
}

const mobileOpen = ref(false)
const pendingCount = ref(0)

const sections = computed<NavSection[]>(() => [
  {
    title: 'Principal',
    items: [
      { label: 'Inicio', to: '/', icon: 'i-lucide-layout-dashboard' },
      { label: 'Herramientas', to: '/herramientas', icon: 'i-lucide-layout-grid' },
      { label: 'Vacaciones', to: '/vacaciones', icon: 'i-lucide-palmtree' },
      { label: 'Calendario', to: '/vacaciones/calendario', icon: 'i-lucide-calendar-days' },
      ...(isManager.value
        ? [
            {
              label: 'Aprobaciones',
              to: '/vacaciones/aprobaciones',
              icon: 'i-lucide-check-check',
              badge: pendingCount.value,
            },
          ]
        : []),
    ],
  },
  {
    title: 'Personal',
    items: [
      ...(isManager.value
        ? [{ label: 'Empleados', to: '/empleados', icon: 'i-lucide-users' }]
        : []),
      { label: 'Fichaje', to: '/fichaje', icon: 'i-lucide-clock' },
      { label: 'Turnos', to: '/turnos', icon: 'i-lucide-calendar-range', phase: 'F2' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { label: 'Gastos', to: '/gastos', icon: 'i-lucide-receipt', phase: 'F3' },
      { label: 'Nóminas', to: '/nominas', icon: 'i-lucide-banknote', phase: 'F3' },
      { label: 'Reclutamiento', to: '/reclutamiento', icon: 'i-lucide-user-plus', phase: 'F4' },
      { label: 'Denuncias', to: '/denuncias', icon: 'i-lucide-shield-check', phase: 'F4' },
    ],
  },
  // Sección ERP: visible solo para quien tiene un rol ERP (grant en
  // user_company_access). Los módulos se filtran por ese rol.
  ...(erpSession.navigation.value.length
    ? [
        {
          title: 'ERP',
          items: [
            {
              label: 'Panel ERP',
              to: '/erp',
              icon: 'i-lucide-layout-grid',
            },
            ...erpSession.navigation.value
              .filter((entry) => entry.key !== 'dashboard')
              .map((entry) => ({
                label: entry.label,
                to: entry.to,
                icon: ERP_NAV_ICONS[entry.key] ?? 'i-lucide-box',
              })),
          ],
        },
      ]
    : []),
  ...(isAdmin.value
    ? [
        {
          title: 'Administración',
          items: [{ label: 'Ajustes', to: '/ajustes', icon: 'i-lucide-settings' }],
        },
      ]
    : []),
])

async function loadPending() {
  if (!isManager.value) return
  try {
    const rows = await $fetch<unknown[]>('/api/leave/requests', {
      query: { scope: 'team', status: 'pending', year: new Date().getFullYear() },
    })
    pendingCount.value = rows.length
  } catch {
    pendingCount.value = 0
  }
}

// La sesión ERP se resuelve en el setup para que la sección del sidebar esté
// disponible desde el SSR (sin parpadeo). Si falla, simplemente no hay ERP.
if (import.meta.server) {
  await erpSession.refresh()
}

onMounted(() => {
  void loadPending()
  if (import.meta.client && !erpSession.loaded.value) {
    void erpSession.refresh()
  }
})
watch(
  () => route.path,
  () => {
    mobileOpen.value = false
    void loadPending()
  },
)
</script>

<template>
  <div class="min-h-screen">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-slate-900 p-5 lg:flex">
      <AppSidebar :sections="sections" />
    </aside>

    <div class="lg:pl-72">
      <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          class="rounded-xl border border-slate-200 p-2 text-slate-600"
          @click="mobileOpen = true"
        >
          <UIcon name="i-lucide-menu" class="size-5" />
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-slate-900">{{ state?.organization.name }}</p>
          <p class="truncate text-xs text-slate-500">{{ displayName }}</p>
        </div>
        <NuxtLink
          to="/vacaciones"
          class="rounded-xl bg-slate-900 p-2 text-white"
          title="Solicitar vacaciones"
        >
          <UIcon name="i-lucide-plus" class="size-5" />
        </NuxtLink>
      </header>

      <main class="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
        <slot />
      </main>
    </div>

    <!-- Modal global de confirmación/prompt para toda la app. -->
    <DialogHost />

    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-50 lg:hidden">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="mobileOpen = false" />
        <aside class="absolute inset-y-0 left-0 flex w-80 max-w-[86vw] flex-col bg-slate-900 p-5">
          <button
            type="button"
            class="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            @click="mobileOpen = false"
          >
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
          <AppSidebar :sections="sections" @navigate="mobileOpen = false" />
        </aside>
      </div>
    </Transition>

    <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div class="flex items-stretch justify-around">
        <NuxtLink
          to="/"
          class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
          :class="route.path === '/' ? 'text-slate-900' : 'text-slate-400'"
        >
          <UIcon name="i-lucide-layout-dashboard" class="size-5" />
          Inicio
        </NuxtLink>
        <NuxtLink
          to="/vacaciones"
          class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
          :class="route.path.startsWith('/vacaciones') ? 'text-slate-900' : 'text-slate-400'"
        >
          <UIcon name="i-lucide-palmtree" class="size-5" />
          Vacaciones
        </NuxtLink>
        <NuxtLink
          v-if="isManager"
          to="/vacaciones/aprobaciones"
          class="relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
          :class="route.path.includes('aprobaciones') ? 'text-slate-900' : 'text-slate-400'"
        >
          <UIcon name="i-lucide-check-check" class="size-5" />
          Aprobar
          <span
            v-if="pendingCount"
            class="absolute right-4 top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white"
          >
            {{ pendingCount }}
          </span>
        </NuxtLink>
        <NuxtLink
          v-else
          to="/vacaciones/calendario"
          class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
          :class="route.path.includes('calendario') ? 'text-slate-900' : 'text-slate-400'"
        >
          <UIcon name="i-lucide-calendar-days" class="size-5" />
          Calendario
        </NuxtLink>
        <NuxtLink
          v-if="isManager"
          to="/empleados"
          class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
          :class="route.path.startsWith('/empleados') ? 'text-slate-900' : 'text-slate-400'"
        >
          <UIcon name="i-lucide-users" class="size-5" />
          Equipo
        </NuxtLink>
        <button
          v-else
          type="button"
          class="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-slate-400"
          @click="mobileOpen = true"
        >
          <UIcon name="i-lucide-menu" class="size-5" />
          Más
        </button>
      </div>
    </nav>
  </div>
</template>
