<script setup lang="ts">
import type { LeaveRequestRow } from '~/types/api'

const { isAdmin } = useSession()
const requestFetch = useRequestFetch()
const toast = useToast()

const year = new Date().getFullYear()
const tab = ref<'pending' | 'history'>('pending')

const scope = computed(() => (isAdmin.value ? 'all' : 'team'))

const { data: requests, refresh } = await useAsyncData<LeaveRequestRow[]>('approvals', () =>
  requestFetch('/api/leave/requests', { query: { scope: scope.value, year } }),
)

const pending = computed(() => (requests.value ?? []).filter((request) => request.status === 'pending'))
const history = computed(() =>
  (requests.value ?? []).filter((request) => ['approved', 'rejected', 'cancelled'].includes(request.status)),
)

const visible = computed(() => (tab.value === 'pending' ? pending.value : history.value))

const rejectOpen = ref(false)
const rejectingId = ref<string | null>(null)
const rejectNote = ref('')
const processingId = ref<string | null>(null)

function openReject(id: string) {
  rejectingId.value = id
  rejectNote.value = ''
  rejectOpen.value = true
}

async function decide(id: string, decision: 'approve' | 'reject', note?: string) {
  processingId.value = id

  try {
    await $fetch(`/api/leave/requests/${id}/decision`, {
      method: 'POST',
      body: { decision, note },
    })

    toast.add({
      title: decision === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      color: decision === 'approve' ? 'success' : 'neutral',
    })

    await Promise.all([refresh(), refreshNuxtData('dash-pending'), refreshNuxtData('dash-balance')])
    rejectOpen.value = false
    rejectingId.value = null
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo completar la acción',
      description: error?.data?.message ?? error?.statusMessage ?? 'Inténtalo de nuevo',
      color: 'error',
    })
  } finally {
    processingId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Aprobaciones"
      subtitle="Revisa las solicitudes del equipo. Al aprobar se revalida el saldo y la cobertura del departamento."
    >
      <UButton to="/vacaciones/calendario" color="neutral" variant="soft" icon="i-lucide-calendar-days">
        Calendario
      </UButton>
    </PageHeader>

    <div class="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        class="rounded-lg px-4 py-2 text-sm font-medium transition"
        :class="tab === 'pending' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'"
        @click="tab = 'pending'"
      >
        Pendientes
        <span
          class="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]"
          :class="tab === 'pending' ? 'bg-white/15' : 'bg-slate-100'"
        >
          {{ pending.length }}
        </span>
      </button>
      <button
        type="button"
        class="rounded-lg px-4 py-2 text-sm font-medium transition"
        :class="tab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'"
        @click="tab = 'history'"
      >
        Historial
      </button>
    </div>

    <div v-if="visible.length" class="space-y-3">
      <div
        v-for="request in visible"
        :key="request.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-start gap-4">
            <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {{ initials(request.employeeFirstName, request.employeeLastName) }}
            </span>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-slate-900">
                  {{ request.employeeFirstName }} {{ request.employeeLastName }}
                </p>
                <UBadge color="neutral" variant="subtle" size="sm">
                  {{ request.departmentName ?? 'Sin departamento' }}
                </UBadge>
              </div>
              <p class="mt-1 text-sm text-slate-600">
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2 rounded-full" :style="{ backgroundColor: request.typeColor }" />
                  {{ request.typeName }}
                </span>
                · {{ request.days }} día(s) · {{ formatDate(request.startDate) }} →
                {{ formatDate(request.endDate) }}
              </p>
              <p v-if="request.reason" class="mt-1 text-xs text-slate-400">{{ request.reason }}</p>
              <p v-if="request.decisionNote" class="mt-1 text-xs text-slate-400">
                Nota: {{ request.decisionNote }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 pl-14 lg:pl-0">
            <StatusBadge :status="request.status" />
            <template v-if="request.status === 'pending'">
              <UButton
                size="sm"
                color="success"
                variant="soft"
                icon="i-lucide-check"
                :loading="processingId === request.id"
                @click="decide(request.id, 'approve')"
              >
                Aprobar
              </UButton>
              <UButton
                size="sm"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                @click="openReject(request.id)"
              >
                Rechazar
              </UButton>
            </template>
          </div>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      :icon="tab === 'pending' ? 'i-lucide-check-check' : 'i-lucide-history'"
      :title="tab === 'pending' ? 'No hay solicitudes pendientes' : 'Sin historial este año'"
      :description="
        tab === 'pending'
          ? 'Cuando alguien del equipo solicite vacaciones aparecerá aquí.'
          : 'Las solicitudes aprobadas, rechazadas o canceladas se listarán aquí.'
      "
    />

    <UModal v-model:open="rejectOpen" title="Rechazar solicitud">
      <template #body>
        <p class="text-sm text-slate-600">
          La persona recibirá una notificación. Puedes añadir el motivo del rechazo.
        </p>
        <UTextarea
          v-model="rejectNote"
          class="mt-3 w-full"
          :rows="3"
          placeholder="No hay cobertura suficiente en esas fechas…"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="rejectOpen = false">Cancelar</UButton>
          <UButton
            color="error"
            :loading="Boolean(rejectingId) && processingId === rejectingId"
            @click="rejectingId && decide(rejectingId, 'reject', rejectNote)"
          >
            Rechazar solicitud
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
