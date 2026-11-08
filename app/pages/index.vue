<script setup lang="ts">
import type { BalanceResponse, CalendarResponse, LeaveRequestRow } from '~/types/api'

const { state, isManager, displayName } = useSession()
const requestFetch = useRequestFetch()
const toast = useToast()

const year = new Date().getFullYear()
const today = todayIso()

const { data: balance } = await useAsyncData<BalanceResponse>('dash-balance', () =>
  requestFetch('/api/leave/balance', { query: { year } }),
)

const { data: mine } = await useAsyncData<LeaveRequestRow[]>('dash-mine', () =>
  requestFetch('/api/leave/requests', { query: { scope: 'mine', year } }),
)

const { data: calendar } = await useAsyncData<CalendarResponse>('dash-calendar', () =>
  requestFetch('/api/leave/calendar', { query: { year } }),
)

const { data: pending } = await useAsyncData<LeaveRequestRow[]>('dash-pending', () =>
  isManager.value
    ? requestFetch('/api/leave/requests', { query: { scope: 'team', status: 'pending', year } })
    : Promise.resolve([]),
)

const {
  status: attendanceStatus,
  clocking: attendanceClocking,
  clock: clockAttendance,
  workedToday: attendanceWorked,
  balanceToday: attendanceBalance,
  nextDirection: attendanceNext,
} = useAttendance('dash-attendance')

const attendanceExpected = computed(() => {
  const fromStatus = attendanceStatus.value?.expectedTodayMinutes ?? 0
  if (fromStatus > 0) return fromStatus

  const employee = state.value?.employee
  const workweek = state.value?.settings.workweek ?? [1, 2, 3, 4, 5]
  if (!employee || workweek.length === 0) return 0

  return workweek.includes(new Date().getDay())
    ? Math.round((employee.weeklyHours * 60) / workweek.length)
    : 0
})

async function toggleDashboardClock() {
  const direction = attendanceNext.value

  try {
    await clockAttendance(direction)
    toast.add({
      title: direction === 'in' ? 'Entrada registrada' : 'Salida registrada',
      description:
        direction === 'out'
          ? `Has trabajado ${formatMinutes(attendanceWorked.value)} hoy.`
          : 'Que tengas buen turno.',
      color: 'success',
    })
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo fichar',
      description: error?.data?.message ?? error?.statusMessage,
      color: 'error',
    })
  }
}

const vacation = computed(() => balance.value?.balances.find((item) => item.code === 'VAC'))
const overtime = computed(() => balance.value?.overtime)

const nextLeave = computed(() =>
  (mine.value ?? [])
    .filter((request) => ['approved', 'pending'].includes(request.status) && request.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(0),
)

const absentToday = computed(
  () =>
    (calendar.value?.events ?? []).filter(
      (event) => event.status === 'approved' && event.startDate <= today && event.endDate >= today,
    ),
)

const myPending = computed(
  () => (mine.value ?? []).filter((request) => request.status === 'pending').length,
)

const stats = computed(() => {
  if (isManager.value) {
    return [
      {
        label: 'Vacaciones disponibles',
        value: vacation.value?.availableDays ?? 0,
        hint: `de ${vacation.value?.totalDays ?? 0} días en ${year}`,
        icon: 'i-lucide-palmtree',
        tone: 'emerald' as const,
      },
      {
        label: 'Disfrutadas',
        value: vacation.value?.usedDays ?? 0,
        hint: `${vacation.value?.reservedDays ?? 0} días reservados`,
        icon: 'i-lucide-check',
        tone: 'sky' as const,
      },
      {
        label: 'Pendientes de aprobar',
        value: pending.value?.length ?? 0,
        hint: 'solicitudes del equipo',
        icon: 'i-lucide-check-check',
        tone: 'amber' as const,
      },
      {
        label: 'Fuera hoy',
        value: absentToday.value.length,
        hint: 'personas ausentes',
        icon: 'i-lucide-users',
        tone: 'violet' as const,
      },
    ]
  }

  return [
    {
      label: 'Vacaciones disponibles',
      value: vacation.value?.availableDays ?? 0,
      hint: `de ${vacation.value?.totalDays ?? 0} días en ${year}`,
      icon: 'i-lucide-palmtree',
      tone: 'emerald' as const,
    },
    {
      label: 'Disfrutadas',
      value: vacation.value?.usedDays ?? 0,
      hint: 'días aprobados',
      icon: 'i-lucide-check',
      tone: 'sky' as const,
    },
    {
      label: 'Solicitudes pendientes',
      value: myPending.value,
      hint: 'esperando respuesta',
      icon: 'i-lucide-hourglass',
      tone: 'amber' as const,
    },
    {
      label: 'Bolsa de horas',
      value: `${overtime.value?.availableHours ?? 0} h`,
      hint: `≈ ${overtime.value?.daysEquivalent ?? 0} días`,
      icon: 'i-lucide-clock',
      tone: 'violet' as const,
    },
  ]
})

const quickLinks = computed(() => [
  {
    title: 'Herramientas',
    description: 'Todos los módulos en un vistazo',
    to: '/herramientas',
    icon: 'i-lucide-layout-grid',
  },
  {
    title: 'Pedir vacaciones',
    description: 'Elige fechas y envía la solicitud',
    to: '/vacaciones',
    icon: 'i-lucide-palmtree',
  },
  {
    title: 'Calendario del equipo',
    description: 'Vista anual por departamento',
    to: '/vacaciones/calendario',
    icon: 'i-lucide-calendar-days',
  },
  {
    title: 'Fichar jornada',
    description: 'Entrada, salida y horas trabajadas',
    to: '/fichaje',
    icon: 'i-lucide-clock',
  },
  ...(isManager.value
    ? [
        {
          title: 'Aprobaciones',
          description: 'Gestiona las solicitudes pendientes',
          to: '/vacaciones/aprobaciones',
          icon: 'i-lucide-check-check',
        },
        {
          title: 'Empleados',
          description: 'Plantilla, importación y exportación',
          to: '/empleados',
          icon: 'i-lucide-users',
        },
      ]
    : []),
])

async function approveRequest(id: string) {
  try {
    await $fetch(`/api/leave/requests/${id}/decision`, {
      method: 'POST',
      body: { decision: 'approve' },
    })
    toast.add({ title: 'Solicitud aprobada', color: 'success' })
    await Promise.all([
      refreshNuxtData('dash-pending'),
      refreshNuxtData('dash-calendar'),
      refreshNuxtData('dash-balance'),
    ])
  } catch (caught) {
    const fetchError = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo aprobar',
      description: fetchError?.data?.message ?? fetchError?.statusMessage ?? 'Inténtalo de nuevo',
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <p class="text-sm text-slate-400">{{ formatDate(new Date()) }} · {{ state?.organization.name }}</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Hola, {{ displayName }}</h1>
        <p class="mt-2 max-w-xl text-sm text-slate-400">
          {{
            isManager
              ? 'Este es el resumen del equipo para hoy. Tienes las solicitudes pendientes a mano.'
              : 'Consulta tu saldo, pide vacaciones y revisa el calendario del equipo.'
          }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton to="/vacaciones" icon="i-lucide-plus" size="lg">Solicitar vacaciones</UButton>
        <UButton
          v-if="isManager"
          to="/vacaciones/aprobaciones"
          color="neutral"
          variant="soft"
          icon="i-lucide-check-check"
          size="lg"
        >
          Aprobar ({{ pending?.length ?? 0 }})
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="state && !state.employee"
      color="warning"
      variant="subtle"
      icon="i-lucide-user-round-x"
      title="Tu usuario no tiene ficha de empleado"
      description="Podrás solicitar vacaciones cuando RRHH vincule tu cuenta a una ficha. Si eres administración, importa la plantilla desde Empleados."
    >
      <template #actions>
        <UButton
          :to="isManager ? '/empleados' : '/cuenta'"
          size="sm"
          color="warning"
          variant="soft"
        >
          {{ isManager ? 'Ir a empleados' : 'Ver mi cuenta' }}
        </UButton>
      </template>
    </UAlert>

    <div
      class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-center gap-4">
        <span class="rounded-xl bg-slate-900 p-2.5 text-white">
          <UIcon name="i-lucide-clock" class="size-5" />
        </span>
        <div>
          <p class="text-sm font-semibold text-slate-900">Fichaje de hoy</p>
          <p class="mt-0.5 text-xs text-slate-500">
            <template v-if="attendanceStatus?.clockedIn">
              Dentro desde {{ formatClockShort(attendanceStatus.openSince) }} ·
            </template>
            {{ formatMinutes(attendanceWorked) }} de {{ formatMinutes(attendanceExpected) }} ·
            balance
            <span
              :class="
                attendanceBalance > 0
                  ? 'text-emerald-600'
                  : attendanceBalance < 0
                    ? 'text-rose-600'
                    : 'text-slate-500'
              "
            >
              {{ formatSignedMinutes(attendanceBalance) }}
            </span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UButton to="/fichaje" color="neutral" variant="ghost" size="sm">Ver detalle</UButton>
        <UButton
          :color="attendanceNext === 'in' ? 'success' : 'error'"
          :icon="attendanceNext === 'in' ? 'i-lucide-log-in' : 'i-lucide-log-out'"
          :loading="attendanceClocking"
          :disabled="!attendanceStatus"
          @click="toggleDashboardClock"
        >
          {{ attendanceNext === 'in' ? 'Fichar entrada' : 'Fichar salida' }}
        </UButton>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :hint="stat.hint"
        :icon="stat.icon"
        :tone="stat.tone"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Tu próxima ausencia</h2>
          <UIcon name="i-lucide-calendar-check" class="size-5 text-slate-400" />
        </div>

        <div v-if="nextLeave" class="mt-5">
          <div class="flex items-center gap-2">
            <span class="size-2.5 rounded-full" :style="{ backgroundColor: nextLeave.typeColor }" />
            <p class="text-sm font-medium text-slate-900">{{ nextLeave.typeName }}</p>
          </div>
          <p class="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            {{ formatDateShort(nextLeave.startDate) }} → {{ formatDateShort(nextLeave.endDate) }}
          </p>
          <p class="mt-1 text-sm text-slate-500">
            {{ nextLeave.days }} días · {{ formatDate(nextLeave.startDate) }}
          </p>
          <div class="mt-4">
            <StatusBadge :status="nextLeave.status" />
          </div>
        </div>

        <EmptyState
          v-else
          icon="i-lucide-palmtree"
          title="Sin ausencias próximas"
          description="Cuando pidas vacaciones aparecerán aquí."
          class="mt-5 border-0 bg-transparent py-8"
        >
          <UButton to="/vacaciones" size="sm" variant="soft">Pedir vacaciones</UButton>
        </EmptyState>
      </div>

      <div v-if="isManager" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Pendientes de aprobar</h2>
          <NuxtLink to="/vacaciones/aprobaciones" class="text-xs font-medium text-sky-600 hover:text-sky-700">
            Ver todas
          </NuxtLink>
        </div>

        <div v-if="pending?.length" class="mt-4 divide-y divide-slate-100">
          <div
            v-for="request in pending.slice(0, 4)"
            :key="request.id"
            class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex items-center gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {{ initials(request.employeeFirstName, request.employeeLastName) }}
              </span>
              <div>
                <p class="text-sm font-medium text-slate-900">
                  {{ request.employeeFirstName }} {{ request.employeeLastName }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ request.typeName }} · {{ formatDateShort(request.startDate) }} →
                  {{ formatDateShort(request.endDate) }} · {{ request.days }} días
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <StatusBadge :status="request.status" />
              <UButton size="xs" color="success" variant="soft" @click="approveRequest(request.id)">
                Aprobar
              </UButton>
            </div>
          </div>
        </div>

        <EmptyState
          v-else
          icon="i-lucide-check-check"
          title="Todo al día"
          description="No hay solicitudes pendientes de aprobación."
          class="mt-4 border-0 bg-transparent py-8"
        />
      </div>

      <div v-else class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">El equipo hoy</h2>
          <span class="text-xs text-slate-500">{{ absentToday.length }} ausentes</span>
        </div>

        <div v-if="absentToday.length" class="mt-4 flex flex-wrap gap-2">
          <div
            v-for="event in absentToday"
            :key="event.id"
            class="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5"
          >
            <span class="size-2 rounded-full" :style="{ backgroundColor: event.typeColor }" />
            <span class="text-sm text-slate-700">
              {{ event.employeeFirstName }} {{ event.employeeLastName }}
            </span>
            <span class="text-xs text-slate-400">{{ event.typeName }}</span>
          </div>
        </div>

        <EmptyState
          v-else
          icon="i-lucide-users"
          title="Nadie de baja hoy"
          description="Todo el equipo está disponible según el calendario."
          class="mt-4 border-0 bg-transparent py-8"
        />
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <NuxtLink
        v-for="link in quickLinks"
        :key="link.to"
        :to="link.to"
        class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      >
        <div class="flex items-center justify-between">
          <span class="rounded-xl bg-slate-100 p-2 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
            <UIcon :name="link.icon" class="size-5" />
          </span>
          <UIcon name="i-lucide-arrow-up-right" class="size-4 text-slate-300 group-hover:text-slate-500" />
        </div>
        <p class="mt-4 text-sm font-semibold text-slate-900">{{ link.title }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ link.description }}</p>
      </NuxtLink>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Equipo fuera hoy</h2>
          <p class="text-xs text-slate-500">Ausencias aprobadas que cubren la fecha de hoy.</p>
        </div>
        <NuxtLink to="/vacaciones/calendario" class="text-xs font-medium text-sky-600 hover:text-sky-700">
          Abrir calendario anual
        </NuxtLink>
      </div>

      <div v-if="absentToday.length" class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th class="pb-2 font-medium">Empleado</th>
              <th class="pb-2 font-medium">Departamento</th>
              <th class="pb-2 font-medium">Tipo</th>
              <th class="pb-2 font-medium">Hasta</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="event in absentToday" :key="event.id">
              <td class="py-2.5 font-medium text-slate-800">
                {{ event.employeeFirstName }} {{ event.employeeLastName }}
              </td>
              <td class="py-2.5 text-slate-500">{{ event.departmentName ?? '—' }}</td>
              <td class="py-2.5">
                <span class="inline-flex items-center gap-1.5 text-slate-600">
                  <span class="size-2 rounded-full" :style="{ backgroundColor: event.typeColor }" />
                  {{ event.typeName }}
                </span>
              </td>
              <td class="py-2.5 text-slate-500">{{ formatDate(event.endDate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="mt-4 text-sm text-slate-500">No hay ausencias aprobadas para hoy.</p>
    </div>
  </div>
</template>
