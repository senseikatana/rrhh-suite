<script setup lang="ts">
const requestFetch = useRequestFetch()
const toast = useToast()

interface OrgSettingsResponse {
  vacationMode: 'natural' | 'working'
  annualVacationDays: number
  carryOverCap: number
  minNoticeDays: number
  workweek: number[]
  overtimeHoursPerDay: number
  attendanceToleranceMinutes: number
  defaultScheduleStart: string | null
  defaultScheduleEnd: string | null
  approvalLevels: number
  seniority: { everyYears: number; extraDays: number; maxExtraDays?: number } | null
}

interface AuditRow {
  id: string
  action: string
  entity: string
  entityId: string | null
  actorUserId: string | null
  createdAt: string
}

const year = new Date().getFullYear()

const { data: settings, refresh } = await useAsyncData<OrgSettingsResponse>('settings-page', () =>
  requestFetch('/api/settings'),
)

const { data: audit } = await useAsyncData<AuditRow[]>('settings-audit', () =>
  requestFetch('/api/audit'),
)

const { data: holidays } = await useAsyncData<{ year: number; dates: string[]; count: number }>(
  'settings-holidays',
  () => requestFetch('/api/leave/holidays', { query: { year } }),
)

const form = reactive({
  vacationMode: 'natural' as 'natural' | 'working',
  annualVacationDays: 30,
  carryOverCap: 0,
  minNoticeDays: 15,
  overtimeHoursPerDay: 8,
  attendanceToleranceMinutes: 5,
  defaultScheduleStart: '',
  defaultScheduleEnd: '',
  approvalLevels: 1,
  workweek: [1, 2, 3, 4, 5] as number[],
  seniorityEnabled: false,
  everyYears: 5,
  extraDays: 1,
  maxExtraDays: 5,
})

const hydrated = ref(false)
const saving = ref(false)

watchEffect(() => {
  const value = settings.value
  if (!value || hydrated.value) return

  form.vacationMode = value.vacationMode
  form.annualVacationDays = value.annualVacationDays
  form.carryOverCap = value.carryOverCap
  form.minNoticeDays = value.minNoticeDays
  form.overtimeHoursPerDay = value.overtimeHoursPerDay
  form.attendanceToleranceMinutes = value.attendanceToleranceMinutes
  form.defaultScheduleStart = value.defaultScheduleStart ?? ''
  form.defaultScheduleEnd = value.defaultScheduleEnd ?? ''
  form.approvalLevels = value.approvalLevels
  form.workweek = [...value.workweek]
  form.seniorityEnabled = Boolean(value.seniority)
  form.everyYears = value.seniority?.everyYears ?? 5
  form.extraDays = value.seniority?.extraDays ?? 1
  form.maxExtraDays = value.seniority?.maxExtraDays ?? 5
  hydrated.value = true
})

const weekdays = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
]

function toggleWeekday(day: number) {
  if (form.workweek.includes(day)) {
    if (form.workweek.length > 1) form.workweek = form.workweek.filter((item) => item !== day)
  } else {
    form.workweek = [...form.workweek, day].sort()
  }
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    'leave.request.create': 'Solicitud creada',
    'leave.request.approve': 'Solicitud aprobada',
    'leave.request.reject': 'Solicitud rechazada',
    'leave.request.cancel': 'Solicitud cancelada',
    'settings.update': 'Configuración actualizada',
    'employees.import': 'Importación de empleados',
    'overtime.create': 'Movimiento de bolsa de horas',
    'attendance.clock.in': 'Fichaje de entrada',
    'attendance.clock.out': 'Fichaje de salida',
    'attendance.correction': 'Corrección de fichaje',
    'attendance.credit_overtime': 'Horas extra a bolsa',
  }
  return labels[action] ?? action
}

async function save() {
  saving.value = true

  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: {
        vacationMode: form.vacationMode,
        annualVacationDays: Number(form.annualVacationDays),
        carryOverCap: Number(form.carryOverCap),
        minNoticeDays: Number(form.minNoticeDays),
        overtimeHoursPerDay: Number(form.overtimeHoursPerDay),
        attendanceToleranceMinutes: Number(form.attendanceToleranceMinutes),
        defaultScheduleStart: form.defaultScheduleStart || null,
        defaultScheduleEnd: form.defaultScheduleEnd || null,
        approvalLevels: Number(form.approvalLevels),
        workweek: form.workweek,
        seniority: form.seniorityEnabled
          ? {
              everyYears: Number(form.everyYears),
              extraDays: Number(form.extraDays),
              maxExtraDays: Number(form.maxExtraDays),
            }
          : null,
      },
    })

    toast.add({ title: 'Configuración guardada', color: 'success' })
    await Promise.all([refresh(), refreshNuxtData('settings-audit')])
  } catch (caught) {
    const error = caught as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'No se pudo guardar',
      description: error?.data?.message ?? error?.statusMessage,
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Ajustes"
      subtitle="Reglas de devengo, festivos y parámetros de aprobación de la empresa."
    >
      <UButton :loading="saving" icon="i-lucide-save" @click="save">Guardar cambios</UButton>
    </PageHeader>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-900">Devengo de vacaciones</h2>
        <p class="mt-1 text-xs text-slate-500">
          Define cómo se cuentan los días y cuántos corresponden al año.
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Modo de cómputo</label>
            <USelect
              v-model="form.vacationMode"
              :items="[
                { label: 'Días naturales (30)', value: 'natural' },
                { label: 'Días laborables (22)', value: 'working' },
              ]"
              class="w-full"
            />
            <p class="mt-1 text-xs text-slate-400">
              En modo laborable se excluyen fines de semana y festivos del calendario.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Días al año</label>
              <UInput v-model="form.annualVacationDays" type="number" min="0" max="365" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Arrastre máximo</label>
              <UInput v-model="form.carryOverCap" type="number" min="0" max="365" class="w-full" />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Días laborables</label>
            <div class="flex gap-1.5">
              <button
                v-for="weekday in weekdays"
                :key="weekday.value"
                type="button"
                class="size-9 rounded-lg text-xs font-semibold transition"
                :class="
                  form.workweek.includes(weekday.value)
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                "
                @click="toggleWeekday(weekday.value)"
              >
                {{ weekday.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-900">Solicitudes y antigüedad</h2>
        <p class="mt-1 text-xs text-slate-500">
          Antelación mínima, niveles de aprobación y días extra por años trabajados.
        </p>

        <div class="mt-5 space-y-4">
          <div class="grid gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Antelación mínima (días)</label>
              <UInput v-model="form.minNoticeDays" type="number" min="0" max="180" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Horas por día</label>
              <UInput v-model="form.overtimeHoursPerDay" type="number" min="1" max="24" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Tolerancia fichaje (min)</label>
              <UInput
                v-model="form.attendanceToleranceMinutes"
                type="number"
                min="0"
                max="120"
                class="w-full"
              />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Entrada por defecto
              </label>
              <input
                v-model="form.defaultScheduleStart"
                type="time"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Salida por defecto
              </label>
              <input
                v-model="form.defaultScheduleEnd"
                type="time"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
            </div>
          </div>
          <p class="text-xs text-slate-400">
            Horario contractual de referencia, por ejemplo 07:20–14:50. Se aplica a quien no tenga
            horario propio; la importación Excel permite fijarlo por empleado.
          </p>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Niveles de aprobación</label>
            <USelect
              v-model="form.approvalLevels"
              :items="[
                { label: '1 · Mando directo', value: 1 },
                { label: '2 · Mando + RRHH', value: 2 },
              ]"
              class="w-full"
            />
          </div>

          <div class="rounded-xl border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-slate-800">Plus por antigüedad</p>
                <p class="text-xs text-slate-500">Días extra por tramos de años.</p>
              </div>
              <USwitch v-model="form.seniorityEnabled" />
            </div>

            <div v-if="form.seniorityEnabled" class="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-600">Cada (años)</label>
                <UInput v-model="form.everyYears" type="number" min="1" class="w-full" />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-600">Días extra</label>
                <UInput v-model="form.extraDays" type="number" min="0" class="w-full" />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-600">Tope</label>
                <UInput v-model="form.maxExtraDays" type="number" min="0" class="w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Festivos {{ year }}</h2>
          <UBadge color="neutral" variant="subtle">{{ holidays?.count ?? 0 }} días</UBadge>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="date in holidays?.dates ?? []"
            :key="date"
            class="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
          >
            {{ formatDate(date) }}
          </span>
        </div>
        <p class="mt-4 text-xs text-slate-400">
          Los festivos se importan desde la plantilla Excel o se añaden por API. La Semana Santa cambia
          cada año y debe incluirse manualmente.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">Auditoría reciente</h2>
          <span class="text-xs text-slate-500">últimos {{ audit?.length ?? 0 }} eventos</span>
        </div>

        <div v-if="audit?.length" class="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          <div
            v-for="entry in audit.slice(0, 20)"
            :key="entry.id"
            class="rounded-xl border border-slate-100 px-3 py-2"
          >
            <p class="text-sm font-medium text-slate-800">{{ actionLabel(entry.action) }}</p>
            <p class="text-xs text-slate-400">
              {{ formatDate(entry.createdAt) }} · {{ entry.entity }}
            </p>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-slate-500">Todavía no hay eventos registrados.</p>
      </div>
    </div>
  </div>
</template>
