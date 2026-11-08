<script setup lang="ts">
import type { BalanceResponse, LeaveRequestRow, LeaveType } from '~/types/api'

const { state, isManager } = useSession()
const requestFetch = useRequestFetch()
const toast = useToast()
const { confirm } = useDialogs()

const year = new Date().getFullYear()
const currentYear = ref(year)

const { data: balance, refresh: refreshBalance } = await useAsyncData<BalanceResponse>(
  'leave-balance',
  () => requestFetch('/api/leave/balance', { query: { year: currentYear.value } }),
)

const { data: requests, refresh: refreshRequests } = await useAsyncData<LeaveRequestRow[]>(
  'leave-requests',
  () => requestFetch('/api/leave/requests', { query: { scope: 'mine', year: currentYear.value } }),
)

const { data: holidayDates } = await useAsyncData<string[]>('leave-holidays', async () => {
  const [current, next] = await Promise.all([
    requestFetch<{ dates: string[] }>('/api/leave/holidays', { query: { year } }),
    requestFetch<{ dates: string[] }>('/api/leave/holidays', { query: { year: year + 1 } }),
  ])
  return [...current.dates, ...next.dates]
})

const types = computed<LeaveType[]>(() => balance.value?.types ?? [])

const form = reactive({
  leaveTypeId: '',
  startDate: '',
  endDate: '',
  reason: '',
})

const submitting = ref(false)

watchEffect(() => {
  if (!form.leaveTypeId && types.value.length > 0) {
    form.leaveTypeId = types.value.find((type) => type.code === 'VAC')?.id ?? types.value[0]!.id
  }
})

const selectedBalance = computed(() =>
  balance.value?.balances.find((item) => item.leaveTypeId === form.leaveTypeId),
)

const previewDays = computed(() =>
  countPreviewDays(
    form.startDate,
    form.endDate,
    state.value?.settings.vacationMode ?? 'natural',
    holidayDates.value ?? [],
    state.value?.settings.workweek ?? [1, 2, 3, 4, 5],
  ),
)

const availableAfter = computed(() => {
  if (!selectedBalance.value) return null
  return Math.round((selectedBalance.value.availableDays - previewDays.value) * 100) / 100
})

const canSubmit = computed(
  () =>
    Boolean(form.leaveTypeId) &&
    Boolean(form.startDate) &&
    Boolean(form.endDate) &&
    previewDays.value > 0 &&
    !submitting.value,
)

const activeRequests = computed(
  () => (requests.value ?? []).filter((request) => request.status !== 'cancelled'),
)

const overtime = computed(() => balance.value?.overtime)

function typeName(leaveTypeId: string) {
  return types.value.find((type) => type.id === leaveTypeId)?.name ?? 'Permiso'
}

function typeColor(leaveTypeId: string) {
  return types.value.find((type) => type.id === leaveTypeId)?.color ?? '#64748b'
}

function percent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}

function balanceLabel() {
  const mode = state.value?.settings.vacationMode
  return mode === 'working' ? 'días laborables' : 'días naturales'
}

async function submit() {
  submitting.value = true

  try {
    const result = await $fetch<{ id: string; days: number; status: string }>('/api/leave/requests', {
      method: 'POST',
      body: {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
      },
    })

    toast.add({
      title: 'Solicitud enviada',
      description:
        result.status === 'approved'
          ? `${result.days} día(s) registrados automáticamente.`
          : `${result.days} día(s) pendientes de aprobación.`,
      color: 'success',
    })

    form.startDate = ''
    form.endDate = ''
    form.reason = ''

    await Promise.all([refreshBalance(), refreshRequests()])
  } catch (caught) {
    const error = caught as { data?: { message?: string; data?: { errors?: string[] } }; statusMessage?: string }
    const messages = error?.data?.data?.errors ?? [error?.data?.message ?? error?.statusMessage ?? 'Inténtalo de nuevo']
    toast.add({
      title: 'No se pudo enviar la solicitud',
      description: messages.filter(Boolean).join(' '),
      color: 'error',
    })
  } finally {
    submitting.value = false
  }
}

async function cancelRequest(id: string) {
  const ok = await confirm({
    title: 'Cancelar solicitud',
    description: '¿Seguro que quieres cancelar esta solicitud?',
    confirmLabel: 'Cancelar solicitud',
    cancelLabel: 'Volver',
    danger: true,
  })
  if (!ok) return

  try {
    await $fetch(`/api/leave/requests/${id}/cancel`, { method: 'POST' })
    toast.add({ title: 'Solicitud cancelada', color: 'success' })
    await Promise.all([refreshBalance(), refreshRequests()])
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo cancelar',
      description: error?.data?.message ?? error?.statusMessage,
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Vacaciones y ausencias"
      subtitle="Consulta tu saldo, solicita días y sigue el estado de tus peticiones."
    >
      <UButton to="/vacaciones/calendario" color="neutral" variant="soft" icon="i-lucide-calendar-days">
        Calendario
      </UButton>
      <UButton
        v-if="isManager"
        to="/vacaciones/aprobaciones"
        color="neutral"
        variant="soft"
        icon="i-lucide-check-check"
      >
        Aprobaciones
      </UButton>
    </PageHeader>

    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="item in (balance?.balances ?? []).filter((entry) => entry.code !== 'COMP')"
        :key="item.leaveTypeId"
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-slate-500">{{ typeName(item.leaveTypeId) }}</p>
            <p class="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {{ item.availableDays }}
              <span class="text-base font-normal text-slate-400">días disponibles</span>
            </p>
          </div>
          <span class="rounded-xl bg-emerald-100 p-2 text-emerald-700">
            <UIcon
              :name="item.code === 'COMP' ? 'i-lucide-clock' : 'i-lucide-palmtree'"
              class="size-5"
            />
          </span>
        </div>

        <div class="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div class="flex h-full">
            <div class="bg-slate-400" :style="{ width: `${percent(item.usedDays, item.totalDays)}%` }" />
            <div class="bg-amber-400" :style="{ width: `${percent(item.reservedDays, item.totalDays)}%` }" />
            <div class="bg-emerald-500" :style="{ width: `${percent(item.availableDays, item.totalDays)}%` }" />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Derecho: <strong class="text-slate-700">{{ item.totalDays }}</strong></span>
          <span>Disfrutado: <strong class="text-slate-700">{{ item.usedDays }}</strong></span>
          <span>Reservado: <strong class="text-slate-700">{{ item.reservedDays }}</strong></span>
        </div>

        <p v-if="item.code === 'COMP'" class="mt-3 text-xs text-slate-400">
          Calculado desde la bolsa de horas ({{ state?.settings.overtimeHoursPerDay }} h = 1 día).
        </p>
        <p v-else class="mt-3 text-xs text-slate-400">
          Año {{ currentYear }} · saldo en {{ balanceLabel() }}.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-slate-400">Bolsa de horas</p>
            <p class="mt-1 text-3xl font-semibold tracking-tight">
              {{ overtime?.availableHours ?? 0 }}
              <span class="text-base font-normal text-slate-400">horas</span>
            </p>
          </div>
          <span class="rounded-xl bg-white/10 p-2 text-sky-300">
            <UIcon name="i-lucide-clock" class="size-5" />
          </span>
        </div>

        <p class="mt-2 text-sm text-slate-400">
          Equivale a {{ overtime?.daysEquivalent ?? 0 }} días de descanso.
        </p>

        <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl bg-white/5 p-3">
            <p class="text-xs text-slate-400">Acumuladas</p>
            <p class="mt-1 font-semibold">{{ overtime?.accruedHours ?? 0 }} h</p>
          </div>
          <div class="rounded-xl bg-white/5 p-3">
            <p class="text-xs text-slate-400">Compensadas</p>
            <p class="mt-1 font-semibold">{{ overtime?.usedHours ?? 0 }} h</p>
          </div>
        </div>

        <p class="mt-4 text-xs text-slate-500">
          La compensación se solicita como permiso de tipo “Compensación de horas”.
        </p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-5">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div class="flex items-center gap-2">
          <span class="rounded-xl bg-sky-100 p-2 text-sky-700">
            <UIcon name="i-lucide-plus" class="size-4" />
          </span>
          <h2 class="text-sm font-semibold text-slate-900">Nueva solicitud</h2>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="submit">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Tipo</label>
            <USelect
              v-model="form.leaveTypeId"
              :items="types.map((type) => ({ label: type.name, value: type.id }))"
              size="lg"
              class="w-full"
            />
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Desde</label>
              <input
                v-model="form.startDate"
                type="date"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                v-model="form.endDate"
                type="date"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Motivo (opcional)</label>
            <UTextarea v-model="form.reason" :rows="2" placeholder="Vacaciones de verano…" class="w-full" />
          </div>

          <div class="rounded-xl bg-slate-50 p-4">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-500">Días solicitados</span>
              <span class="font-semibold text-slate-900">{{ previewDays }}</span>
            </div>
            <div v-if="availableAfter !== null" class="mt-2 flex items-center justify-between text-sm">
              <span class="text-slate-500">Saldo después</span>
              <span
                class="font-semibold"
                :class="availableAfter < 0 ? 'text-rose-600' : 'text-emerald-600'"
              >
                {{ availableAfter }}
              </span>
            </div>
            <p class="mt-3 text-xs leading-relaxed text-slate-400">
              Cálculo en {{ balanceLabel() }}. Los festivos del calendario se excluyen en modo laborable.
              El servidor valida saldo, solapes y cobertura del departamento.
            </p>
          </div>

          <UButton
            type="submit"
            size="lg"
            block
            icon="i-lucide-send"
            :loading="submitting"
            :disabled="!canSubmit"
          >
            Enviar solicitud
          </UButton>
        </form>
      </div>

      <div class="space-y-4 lg:col-span-3">
        <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 class="text-sm font-semibold text-slate-900">Mis solicitudes</h2>
            <span class="text-xs text-slate-500">{{ activeRequests.length }} este año</span>
          </div>

          <div v-if="activeRequests.length" class="divide-y divide-slate-100">
            <div
              v-for="request in activeRequests"
              :key="request.id"
              class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-start gap-3">
                <span
                  class="mt-1 size-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: typeColor(request.leaveTypeId) }"
                />
                <div>
                  <p class="text-sm font-medium text-slate-900">
                    {{ typeName(request.leaveTypeId) }} · {{ request.days }} día(s)
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ formatDate(request.startDate) }} → {{ formatDate(request.endDate) }}
                  </p>
                  <p v-if="request.reason" class="mt-1 text-xs text-slate-400">{{ request.reason }}</p>
                </div>
              </div>

              <div class="flex items-center gap-2 pl-6 sm:pl-0">
                <StatusBadge :status="request.status" />
                <UButton
                  v-if="['pending', 'approved'].includes(request.status) && request.endDate >= todayIso()"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="cancelRequest(request.id)"
                >
                  Cancelar
                </UButton>
              </div>
            </div>
          </div>

          <EmptyState
            v-else
            icon="i-lucide-inbox"
            title="Todavía no hay solicitudes"
            description="Usa el formulario para pedir tus primeros días."
            class="m-6 border-0 bg-transparent"
          />
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-900">Bolsa de horas · movimientos</h2>
            <span class="text-xs text-slate-500">{{ overtime?.entries.length ?? 0 }} registros</span>
          </div>

          <div v-if="overtime?.entries.length" class="mt-4 space-y-2">
            <div
              v-for="entry in [...overtime.entries].reverse().slice(0, 6)"
              :key="entry.id"
              class="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
            >
              <div>
                <p class="font-medium text-slate-800">{{ formatDate(entry.date) }}</p>
                <p class="text-xs text-slate-500">{{ entry.note ?? 'Sin nota' }}</p>
              </div>
              <span
                class="font-semibold"
                :class="entry.type === 'accrued' ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ entry.type === 'accrued' ? '+' : '−' }}{{ Math.abs(entry.hours) }} h
              </span>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-slate-500">No hay horas registradas.</p>
        </div>
      </div>
    </div>
  </div>
</template>
