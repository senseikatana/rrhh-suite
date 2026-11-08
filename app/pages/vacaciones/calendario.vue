<script setup lang="ts">
import type { CalendarEvent, CalendarResponse, DepartmentRow, EmployeeRow } from '~/types/api'

const { state, isManager } = useSession()
const requestFetch = useRequestFetch()

const now = new Date()
const year = ref(now.getFullYear())
const departmentId = ref('all')
const selectedMonth = ref(now.getMonth())
const monthView = ref<HTMLElement | null>(null)

const { data: calendar } = await useAsyncData<CalendarResponse>(
  'calendar-page',
  () =>
    requestFetch('/api/leave/calendar', {
      query: {
        year: year.value,
        departmentId: departmentId.value === 'all' ? undefined : departmentId.value,
      },
    }),
  { watch: [year, departmentId] },
)

const { data: holidayData } = await useAsyncData<{ dates: string[] }>(
  'calendar-holidays',
  () => requestFetch('/api/leave/holidays', { query: { year: year.value } }),
  { watch: [year] },
)

const { data: departments } = await useAsyncData<DepartmentRow[]>('calendar-departments', () =>
  isManager.value ? requestFetch('/api/departments') : Promise.resolve([]),
)

const { data: employees } = await useAsyncData<EmployeeRow[]>('calendar-employees', () =>
  isManager.value ? requestFetch('/api/employees') : Promise.resolve([]),
)

const events = computed<CalendarEvent[]>(() => calendar.value?.events ?? [])
const holidays = computed(() => new Set(holidayData.value?.dates ?? []))

const rows = computed(() => {
  if (isManager.value) {
    return (employees.value ?? [])
      .filter(
        (employee) =>
          employee.active &&
          (departmentId.value === 'all' || employee.departmentId === departmentId.value),
      )
      .map((employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        department: employee.departmentName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  const me = state.value?.employee
  return me ? [{ id: me.id, name: `${me.firstName} ${me.lastName}`, department: null }] : []
})

const legend = computed(() => {
  const seen = new Map<string, { name: string; color: string }>()
  for (const event of events.value) {
    if (!seen.has(event.typeCode)) seen.set(event.typeCode, { name: event.typeName, color: event.typeColor })
  }
  return [...seen.values()]
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function monthBounds(month: number) {
  const days = new Date(year.value, month + 1, 0).getDate()
  return {
    start: `${year.value}-${pad(month + 1)}-01`,
    end: `${year.value}-${pad(month + 1)}-${pad(days)}`,
  }
}

function daysFor(employeeId: string, month: number, status: 'approved' | 'pending') {
  const { start, end } = monthBounds(month)

  return events.value
    .filter((event) => event.employeeId === employeeId && event.status === status)
    .reduce((sum, event) => {
      const from = event.startDate > start ? event.startDate : start
      const to = event.endDate < end ? event.endDate : end
      if (to < from) return sum
      return sum + countPreviewDays(from, to, 'natural', [], [0, 1, 2, 3, 4, 5, 6])
    }, 0)
}

function heatClass(days: number) {
  if (days === 0) return 'bg-slate-50 text-slate-300'
  if (days <= 3) return 'bg-sky-100 text-sky-700'
  if (days <= 7) return 'bg-sky-300 text-sky-900'
  if (days <= 14) return 'bg-sky-500 text-white'
  return 'bg-sky-700 text-white'
}

function selectMonth(month: number) {
  selectedMonth.value = month
  nextTick(() => monthView.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function exportExcel() {
  if (import.meta.client) {
    window.location.href = `/api/exports/leave.xlsx?year=${year.value}`
  }
}

const monthDays = computed(() => {
  const first = new Date(year.value, selectedMonth.value, 1)
  const offset = (first.getDay() + 6) % 7
  const totalDays = new Date(year.value, selectedMonth.value + 1, 0).getDate()
  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = []

  for (let index = 0; index < offset; index += 1) {
    cells.push({ iso: '', day: 0, inMonth: false })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      iso: `${year.value}-${pad(selectedMonth.value + 1)}-${pad(day)}`,
      day,
      inMonth: true,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ iso: '', day: 0, inMonth: false })
  }

  return cells
})

function eventsOnDay(iso: string) {
  if (!iso) return []
  return events.value.filter((event) => event.startDate <= iso && event.endDate >= iso && event.status === 'approved')
}

function pendingOnDay(iso: string) {
  if (!iso) return []
  return events.value.filter((event) => event.startDate <= iso && event.endDate >= iso && event.status === 'pending')
}

const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const departmentItems = computed(() => [
  { label: 'Todos los departamentos', value: 'all' },
  ...(departments.value ?? []).map((department) => ({ label: department.name, value: department.id })),
])
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Calendario anual"
      subtitle="Vista de ausencias por empleado y mes. Pasa el cursor por una celda para ver el detalle."
    >
      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-left"
          square
          @click="year -= 1"
        />
        <span class="min-w-16 text-center text-lg font-semibold text-slate-900">{{ year }}</span>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-right"
          square
          @click="year += 1"
        />
      </div>
      <UButton
        v-if="isManager"
        color="neutral"
        variant="soft"
        icon="i-lucide-download"
        @click="exportExcel"
      >
        Exportar
      </UButton>
    </PageHeader>

    <div v-if="isManager" class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <USelect v-model="departmentId" :items="departmentItems" class="w-full sm:w-72" />
      <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span v-for="item in legend" :key="item.name" class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full" :style="{ backgroundColor: item.color }" />
          {{ item.name }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full bg-amber-400" />
          Pendiente
        </span>
      </div>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50/60">
            <th class="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Empleado
            </th>
            <th
              v-for="month in 12"
              :key="month"
              class="px-1 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ formatMonthShort(month - 1) }}
            </th>
            <th class="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Total
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="row in rows" :key="row.id" class="hover:bg-slate-50/60">
            <td class="sticky left-0 z-10 bg-white px-4 py-2.5">
              <p class="text-sm font-medium text-slate-800">{{ row.name }}</p>
              <p class="text-[11px] text-slate-400">{{ row.department ?? 'Sin departamento' }}</p>
            </td>
            <td v-for="month in 12" :key="month" class="px-1 py-1.5 text-center">
              <button
                type="button"
                class="relative mx-auto flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition hover:ring-2 hover:ring-slate-300"
                :class="heatClass(daysFor(row.id, month - 1, 'approved'))"
                :title="`${row.name} · ${formatMonth(month - 1)}: ${daysFor(row.id, month - 1, 'approved')} días aprobados, ${daysFor(row.id, month - 1, 'pending')} pendientes`"
                @click="selectMonth(month - 1)"
              >
                {{ daysFor(row.id, month - 1, 'approved') || '' }}
                <span
                  v-if="daysFor(row.id, month - 1, 'pending') > 0"
                  class="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-400"
                />
              </button>
            </td>
            <td class="px-3 py-2.5 text-center text-sm font-semibold text-slate-700">
              {{
                Array.from({ length: 12 }, (_, index) => daysFor(row.id, index, 'approved')).reduce(
                  (sum, value) => sum + value,
                  0,
                )
              }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="rows.length === 0" class="px-6 py-10 text-center text-sm text-slate-500">
        No hay empleados que mostrar con los filtros actuales.
      </div>
    </div>

    <div ref="monthView" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-base font-semibold capitalize text-slate-900">
          {{ formatMonth(selectedMonth) }} {{ year }}
        </h2>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="month in 12"
            :key="month"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition"
            :class="
              selectedMonth === month - 1
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            "
            @click="selectedMonth = month - 1"
          >
            {{ formatMonthShort(month - 1) }}
          </button>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-7 gap-1 text-center">
        <div v-for="weekday in weekdays" :key="weekday" class="pb-2 text-[11px] font-semibold uppercase text-slate-400">
          {{ weekday }}
        </div>

        <div
          v-for="(cell, index) in monthDays"
          :key="`${cell.iso}-${index}`"
          class="min-h-20 rounded-xl border p-1.5 text-left"
          :class="
            cell.inMonth
              ? holidays.has(cell.iso)
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-100 bg-white'
              : 'border-transparent bg-slate-50/40'
          "
        >
          <div v-if="cell.inMonth" class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">{{ cell.day }}</span>
            <span v-if="holidays.has(cell.iso)" class="text-[9px] font-semibold uppercase text-amber-600">
              Festivo
            </span>
          </div>

          <div v-if="cell.inMonth" class="mt-1 space-y-0.5">
            <div
              v-for="event in eventsOnDay(cell.iso).slice(0, 2)"
              :key="event.id"
              class="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
              :style="{ backgroundColor: event.typeColor }"
              :title="`${event.employeeFirstName} ${event.employeeLastName} · ${event.typeName}`"
            >
              {{ event.employeeFirstName }}
            </div>
            <p
              v-if="eventsOnDay(cell.iso).length > 2"
              class="px-1 text-[10px] font-medium text-slate-400"
            >
              +{{ eventsOnDay(cell.iso).length - 2 }} más
            </p>
            <div
              v-if="pendingOnDay(cell.iso).length"
              class="px-1 text-[10px] font-medium text-amber-500"
              :title="`${pendingOnDay(cell.iso).length} solicitud(es) pendiente(s)`"
            >
              {{ pendingOnDay(cell.iso).length }} pendiente(s)
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
