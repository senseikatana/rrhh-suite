<script setup lang="ts">
import type {
  AttendanceDay,
  AttendanceSummary,
  TeamAttendanceResponse,
  TeamAttendanceRow,
} from '~/types/attendance'

const { state, isManager } = useSession()
const requestFetch = useRequestFetch()
const toast = useToast()

const {
  status,
  refresh: refreshStatus,
  clocking,
  clock,
  now,
  liveElapsed,
  workedToday,
  balanceToday,
  nextDirection,
  error: attendanceError,
} = useAttendance('fichaje-status')

const today = todayKey()
const weekFrom = startOfWeekKey(today)
const weekTo = endOfWeekKey(today)
const monthFrom = startOfMonthKey(today)
const monthTo = endOfMonthKey(today)

const hasEmployee = computed(() => Boolean(state.value?.employee))

const { data: week, refresh: refreshWeek } = await useAsyncData<AttendanceSummary | null>(
  'fichaje-week',
  () =>
    hasEmployee.value
      ? requestFetch('/api/attendance/summary', { query: { from: weekFrom, to: weekTo } })
      : Promise.resolve(null),
)

const { data: month, refresh: refreshMonth } = await useAsyncData<AttendanceSummary | null>(
  'fichaje-month',
  () =>
    hasEmployee.value
      ? requestFetch('/api/attendance/summary', { query: { from: monthFrom, to: monthTo } })
      : Promise.resolve(null),
)

const { data: team, refresh: refreshTeam } = await useAsyncData<TeamAttendanceResponse | null>(
  'fichaje-team',
  () => (isManager.value ? requestFetch('/api/attendance/team') : Promise.resolve(null)),
)

const expectedToday = computed(() => {
  const fromStatus = status.value?.expectedTodayMinutes ?? 0
  if (fromStatus > 0) return fromStatus

  const employee = state.value?.employee
  const workweek = state.value?.settings.workweek ?? [1, 2, 3, 4, 5]
  if (!employee || workweek.length === 0) return 0

  return workweek.includes(new Date().getDay())
    ? Math.round((employee.weeklyHours * 60) / workweek.length)
    : 0
})

const monthDays = computed(
  () => month.value?.days.filter((day) => day.sessions.length > 0 || day.anomalies.length > 0) ?? [],
)

const teamRows = computed(() => team.value?.rows ?? [])

const teamOptions = computed(() =>
  teamRows.value.map((row) => ({
    label: `${row.firstName} ${row.lastName}`,
    value: row.employeeId,
  })),
)

function balanceClass(minutes: number) {
  if (minutes > 0) return 'text-emerald-600'
  if (minutes < 0) return 'text-rose-600'
  return 'text-slate-400'
}

function statusColor(row: TeamAttendanceRow): 'success' | 'neutral' | 'warning' | 'info' {
  if (row.leave) return 'info'
  if (row.clockedIn) return 'success'
  if (row.lastEventAt) return 'neutral'
  return 'warning'
}

function statusLabel(row: TeamAttendanceRow) {
  if (row.leave) return row.leave.typeName
  if (row.clockedIn) return 'Trabajando'
  if (row.lastEventAt) return 'Fuera'
  return 'Sin fichar'
}

async function toggleClock() {
  const direction = nextDirection.value

  try {
    await clock(direction)
    toast.add({
      title: direction === 'in' ? 'Entrada registrada' : 'Salida registrada',
      description:
        direction === 'out'
          ? `Has trabajado ${formatMinutes(workedToday.value)} hoy.`
          : `Estás dentro desde las ${formatClockShort(new Date())}.`,
      color: 'success',
    })
    await Promise.all([refreshWeek(), refreshMonth(), refreshTeam()])
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo fichar',
      description: error?.data?.message ?? error?.statusMessage,
      color: 'error',
    })
  }
}

async function creditDay(day: AttendanceDay) {
  const employee = state.value?.employee
  if (!employee) return

  try {
    const result = await $fetch<{ hours: number }>('/api/attendance/credit', {
      method: 'POST',
      body: { employeeId: employee.id, date: day.date },
    })
    toast.add({
      title: `${result.hours} h acreditadas en la bolsa`,
      description: `Horas extra del ${formatDate(day.date)}.`,
      color: 'success',
    })
    await Promise.all([refreshMonth(), refreshStatus()])
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudieron acreditar las horas',
      description: error?.data?.message ?? error?.statusMessage,
      color: 'error',
    })
  }
}

const correctionOpen = ref(false)
const correctionSaving = ref(false)
const correction = reactive({
  employeeId: '',
  date: today,
  time: '09:00',
  direction: 'in' as 'in' | 'out',
  note: '',
})

function openCorrection(row?: TeamAttendanceRow) {
  correction.employeeId = row?.employeeId ?? teamRows.value[0]?.employeeId ?? ''
  correction.date = today
  correction.time = '09:00'
  correction.direction = 'in'
  correction.note = ''
  correctionOpen.value = true
}

async function submitCorrection() {
  if (!correction.employeeId) {
    toast.add({ title: 'Selecciona un empleado', color: 'error' })
    return
  }

  correctionSaving.value = true

  try {
    await $fetch('/api/attendance/correction', {
      method: 'POST',
      body: {
        employeeId: correction.employeeId,
        date: correction.date,
        time: correction.time,
        direction: correction.direction,
        note: correction.note || undefined,
      },
    })
    toast.add({ title: 'Fichaje corregido', color: 'success' })
    correctionOpen.value = false
    await Promise.all([refreshStatus(), refreshWeek(), refreshMonth(), refreshTeam()])
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo corregir',
      description: error?.data?.message ?? error?.statusMessage,
      color: 'error',
    })
  } finally {
    correctionSaving.value = false
  }
}

function exportRegister() {
  if (import.meta.client) {
    window.location.href = `/api/exports/attendance.xlsx?from=${monthFrom}&to=${monthTo}`
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Fichaje y jornada"
      subtitle="Registra tu entrada y salida y consulta las horas trabajadas, el balance y las incidencias."
    >
      <UButton
        v-if="isManager"
        color="neutral"
        variant="soft"
        icon="i-lucide-file-down"
        @click="exportRegister"
      >
        Exportar registro
      </UButton>
      <UButton
        v-if="isManager"
        color="neutral"
        variant="soft"
        icon="i-lucide-user-check"
        @click="openCorrection()"
      >
        Corregir fichaje
      </UButton>
    </PageHeader>

    <UAlert
      v-if="attendanceError || (state && !state.employee)"
      color="warning"
      variant="subtle"
      icon="i-lucide-user-round-x"
      title="Sin ficha de empleado"
      description="Tu usuario no está vinculado a una ficha, así que no puede fichar. RRHH puede importar o crear tu ficha con el mismo email."
    />

    <div class="rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm text-slate-400">{{ formatDate(today) }}</p>
          <p class="mt-1 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
            {{ formatClock(now) }}
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UBadge :color="status?.clockedIn ? 'success' : 'neutral'" variant="subtle">
              {{ status?.clockedIn ? 'Trabajando' : 'Fuera' }}
            </UBadge>
            <span v-if="status?.clockedIn" class="text-sm text-slate-400">
              Dentro desde {{ formatClockShort(status.openSince) }} ·
              {{ formatMinutes(liveElapsed) }}
            </span>
            <span v-else-if="status?.lastEventAt" class="text-sm text-slate-400">
              Último fichaje {{ formatClockShort(status.lastEventAt) }}
            </span>
            <span v-else class="text-sm text-slate-400">Todavía no has fichado hoy</span>
          </div>
          <p
            v-if="status?.scheduleStart && status?.scheduleEnd"
            class="mt-2 text-sm text-slate-400"
          >
            Horario contractual {{ status.scheduleStart }}–{{ status.scheduleEnd }}
            <span v-if="status.firstIn">
              · Entrada {{ formatClockShort(status.firstIn) }}
              <span v-if="status.lateMinutes" class="text-amber-400">
                (+{{ status.lateMinutes }} min)
              </span>
            </span>
            <span v-if="status.lastOut">
              · Salida {{ formatClockShort(status.lastOut) }}
              <span v-if="status.earlyLeaveMinutes" class="text-rose-400">
                (−{{ status.earlyLeaveMinutes }} min)
              </span>
            </span>
          </p>
        </div>

        <UButton
          size="xl"
          :color="nextDirection === 'in' ? 'success' : 'error'"
          :icon="nextDirection === 'in' ? 'i-lucide-log-in' : 'i-lucide-log-out'"
          :loading="clocking"
          :disabled="!status"
          @click="toggleClock"
        >
          {{ nextDirection === 'in' ? 'Fichar entrada' : 'Fichar salida' }}
        </UButton>
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Trabajado hoy</p>
          <p class="mt-1 text-xl font-semibold">{{ formatMinutes(workedToday) }}</p>
        </div>
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Jornada prevista</p>
          <p class="mt-1 text-xl font-semibold">{{ formatMinutes(expectedToday) }}</p>
        </div>
        <div class="rounded-xl bg-white/5 p-4">
          <p class="text-xs text-slate-400">Balance de hoy</p>
          <p
            class="mt-1 text-xl font-semibold"
            :class="
              balanceToday > 0
                ? 'text-emerald-400'
                : balanceToday < 0
                  ? 'text-rose-400'
                  : 'text-white'
            "
          >
            {{ formatSignedMinutes(balanceToday) }}
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-5">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Semana actual</h2>
          <span class="text-xs text-slate-500">
            {{ formatMinutes(week?.workedMinutes ?? 0) }} de
            {{ formatMinutes(week?.expectedMinutes ?? 0) }}
          </span>
        </div>

        <div class="mt-4 grid grid-cols-7 gap-1.5">
          <div
            v-for="day in week?.days ?? []"
            :key="day.date"
            class="rounded-xl border p-2 text-center"
            :class="day.date === today ? 'border-slate-900 bg-slate-50' : 'border-slate-100'"
          >
            <p class="text-[10px] font-semibold uppercase text-slate-400">
              {{ weekdayLabel(day.date) }}
            </p>
            <p class="text-sm font-semibold text-slate-900">{{ dayNumber(day.date) }}</p>
            <p class="mt-1.5 text-[11px] text-slate-600">
              {{ day.sessions.length ? formatMinutes(day.workedMinutes) : '—' }}
            </p>
            <p class="mt-0.5 text-[11px] font-medium" :class="balanceClass(day.balanceMinutes)">
              {{ day.sessions.length ? formatSignedMinutes(day.balanceMinutes) : '' }}
            </p>
            <span
              v-if="day.openSession"
              class="mt-1 inline-block size-1.5 rounded-full bg-emerald-500"
              title="Sesión abierta"
            />
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span class="text-slate-500">Balance semanal</span>
          <span class="font-semibold" :class="balanceClass(week?.balanceMinutes ?? 0)">
            {{ formatSignedMinutes(week?.balanceMinutes ?? 0) }}
          </span>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Fichajes de hoy</h2>
          <span class="text-xs text-slate-500">{{ status?.eventsToday?.length ?? 0 }} marcas</span>
        </div>

        <div v-if="status?.eventsToday?.length" class="mt-4 space-y-2">
          <div
            v-for="event in status.eventsToday"
            :key="event.id"
            class="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2"
          >
            <span
              class="mt-0.5 rounded-lg p-1.5"
              :class="
                event.direction === 'in'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              "
            >
              <UIcon
                :name="event.direction === 'in' ? 'i-lucide-log-in' : 'i-lucide-log-out'"
                class="size-3.5"
              />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-slate-800">
                {{ event.direction === 'in' ? 'Entrada' : 'Salida' }} ·
                {{ formatClockShort(event.occurredAt) }}
              </p>
              <p class="text-xs text-slate-400">
                {{
                  event.source === 'mobile' ? 'Móvil' : event.source === 'kiosk' ? 'Kiosco' : 'Web'
                }}
                <span v-if="event.note"> · {{ event.note }}</span>
              </p>
            </div>
            <UBadge v-if="event.corrected" color="warning" variant="subtle" size="xs">
              Corregido
            </UBadge>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-slate-500">Sin fichajes registrados hoy.</p>

        <p
          v-if="status?.openSince && status.eventsToday?.every((event) => event.direction !== 'in')"
          class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700"
        >
          Tienes un turno abierto desde el {{ formatDate(status.openSince) }}. Ficha la salida para
          cerrarlo.
        </p>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        class="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Detalle del mes</h2>
          <p class="text-xs text-slate-500">
            {{ formatDate(monthFrom) }} → {{ formatDate(monthTo) }} ·
            {{ formatMinutes(month?.workedMinutes ?? 0) }} trabajadas
          </p>
        </div>
        <span class="text-sm font-semibold" :class="balanceClass(month?.balanceMinutes ?? 0)">
          {{ formatSignedMinutes(month?.balanceMinutes ?? 0) }}
        </span>
      </div>

      <div v-if="monthDays.length" class="overflow-x-auto">
        <table class="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr
              class="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-400"
            >
              <th class="px-4 py-2.5 font-semibold">Fecha</th>
              <th class="px-4 py-2.5 font-semibold">Entrada</th>
              <th class="px-4 py-2.5 font-semibold">Salida</th>
              <th class="px-4 py-2.5 font-semibold">Sesiones</th>
              <th class="px-4 py-2.5 font-semibold">Trabajado</th>
              <th class="px-4 py-2.5 font-semibold">Esperado</th>
              <th class="px-4 py-2.5 font-semibold">Saldo</th>
              <th class="px-4 py-2.5 font-semibold">Extra</th>
              <th class="px-4 py-2.5 font-semibold">Incidencias</th>
              <th class="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="day in monthDays" :key="day.date" class="hover:bg-slate-50/60">
              <td class="px-4 py-2.5">
                <p class="font-medium text-slate-800">{{ formatDate(day.date) }}</p>
                <p class="text-xs text-slate-400">{{ weekdayLabel(day.date, false) }}</p>
              </td>
              <td class="px-4 py-2.5">
                <p class="text-slate-700">
                  {{ day.firstIn ? formatClockShort(day.firstIn) : '—' }}
                </p>
                <p v-if="day.lateMinutes" class="text-[11px] font-medium text-amber-600">
                  +{{ day.lateMinutes }} min
                </p>
              </td>
              <td class="px-4 py-2.5">
                <p class="text-slate-700">
                  {{ day.lastOut ? formatClockShort(day.lastOut) : '—' }}
                </p>
                <p v-if="day.earlyLeaveMinutes" class="text-[11px] font-medium text-rose-600">
                  −{{ day.earlyLeaveMinutes }} min
                </p>
              </td>
              <td class="px-4 py-2.5 text-slate-500">{{ day.sessions.length }}</td>
              <td class="px-4 py-2.5 text-slate-700">{{ formatMinutes(day.workedMinutes) }}</td>
              <td class="px-4 py-2.5 text-slate-500">{{ formatMinutes(day.expectedMinutes) }}</td>
              <td class="px-4 py-2.5 font-medium" :class="balanceClass(day.balanceMinutes)">
                {{ formatSignedMinutes(day.balanceMinutes) }}
              </td>
              <td class="px-4 py-2.5">
                <span v-if="day.overtimeMinutes" class="font-medium text-emerald-600">
                  +{{ formatMinutes(day.overtimeMinutes) }}
                </span>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-2.5">
                <p v-if="day.anomalies.length" class="max-w-xs text-xs text-amber-600">
                  {{ day.anomalies.join(' ') }}
                </p>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-2.5 text-right">
                <UButton
                  v-if="isManager && day.overtimeMinutes > 0"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  @click="creditDay(day)"
                >
                  A bolsa
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <EmptyState
        v-else
        icon="i-lucide-clock"
        title="Sin fichajes este mes"
        description="Cuando registres entradas y salidas verás aquí el detalle diario y el balance."
        class="m-6 border-0 bg-transparent"
      />
    </div>

    <div v-if="isManager" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        class="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Equipo ahora</h2>
          <p class="text-xs text-slate-500">
            {{ teamRows.filter((row) => row.clockedIn).length }} personas dentro ·
            {{
              teamRows.filter((row) => !row.clockedIn && !row.lastEventAt && !row.leave).length
            }}
            sin fichar
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            @click="refreshTeam()"
          >
            Actualizar
          </UButton>
          <UButton size="sm" variant="soft" icon="i-lucide-plus" @click="openCorrection()">
            Corregir
          </UButton>
        </div>
      </div>

      <div v-if="teamRows.length" class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr
              class="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-400"
            >
              <th class="px-4 py-2.5 font-semibold">Empleado</th>
              <th class="px-4 py-2.5 font-semibold">Departamento</th>
              <th class="px-4 py-2.5 font-semibold">Estado</th>
              <th class="px-4 py-2.5 font-semibold">Desde</th>
              <th class="px-4 py-2.5 font-semibold">Trabajado</th>
              <th class="px-4 py-2.5 font-semibold">Balance</th>
              <th class="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in teamRows" :key="row.employeeId" class="hover:bg-slate-50/60">
              <td class="px-4 py-2.5">
                <p class="font-medium text-slate-900">{{ row.firstName }} {{ row.lastName }}</p>
                <p class="text-xs text-slate-400">{{ row.position ?? '—' }}</p>
              </td>
              <td class="px-4 py-2.5 text-slate-500">{{ row.departmentName ?? '—' }}</td>
              <td class="px-4 py-2.5">
                <UBadge :color="statusColor(row)" variant="subtle" size="sm">
                  {{ statusLabel(row) }}
                </UBadge>
              </td>
              <td class="px-4 py-2.5 text-slate-500">
                {{
                  row.clockedIn ? formatClockShort(row.openSince) : formatClockShort(row.lastEventAt)
                }}
              </td>
              <td class="px-4 py-2.5 text-slate-700">{{ formatMinutes(row.workedTodayMinutes) }}</td>
              <td class="px-4 py-2.5 font-medium" :class="balanceClass(row.balanceTodayMinutes)">
                {{ formatSignedMinutes(row.balanceTodayMinutes) }}
              </td>
              <td class="px-4 py-2.5 text-right">
                <UButton size="xs" color="neutral" variant="ghost" @click="openCorrection(row)">
                  Corregir
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="px-5 py-8 text-sm text-slate-500">No hay empleados activos.</p>
    </div>

    <UModal v-model:open="correctionOpen" title="Corregir fichaje">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-slate-600">
            La corrección queda registrada como manual y auditada. Úsala para olvidos o errores de
            fichaje.
          </p>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Empleado</label>
            <USelect v-model="correction.employeeId" :items="teamOptions" class="w-full" />
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
              <input
                v-model="correction.date"
                type="date"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Hora</label>
              <input
                v-model="correction.time"
                type="time"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
              <USelect
                v-model="correction.direction"
                :items="[
                  { label: 'Entrada', value: 'in' },
                  { label: 'Salida', value: 'out' },
                ]"
                class="w-full"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Motivo</label>
            <UTextarea
              v-model="correction.note"
              :rows="2"
              placeholder="Olvidó fichar la salida…"
              class="w-full"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="correctionOpen = false">Cancelar</UButton>
          <UButton :loading="correctionSaving" @click="submitCorrection">Guardar corrección</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
