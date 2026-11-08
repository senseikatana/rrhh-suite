<script setup lang="ts">
import type { DemandLine, Page } from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const session = useErpSession()
const { number, date } = useErpFormat()
const { confirm } = useDialogs()
const toast = useToast()

const lines = ref<DemandLine[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

const coverageRatio = ref(1.5)
const horizonDays = ref(30)

const canManage = computed(() => session.hasRole('admin', 'buyer'))

async function load() {
  loading.value = true
  const res = await api.get<Page<DemandLine>>('demand', {
    query: { limit: 200, action: 'PENDING' },
  })
  if (res.ok) {
    lines.value = res.data.items
    total.value = res.data.meta.total
    error.value = null
  } else {
    error.value = res.error?.message ?? 'No se pudo cargar la hoja de demanda'
  }
  loading.value = false
}

onMounted(async () => {
  await session.refresh()
  await load()
})

async function regenerate() {
  const ok = await confirm({
    title: 'Reconstruir hoja de demanda',
    description: 'Las líneas pendientes se recalcularán. Las marcadas como pedidas o ignoradas se conservan.',
    confirmLabel: 'Reconstruir',
  })
  if (!ok) return

  const res = await api.post<{ lines: number; items: DemandLine[] }>('demandGenerate', {
    coverageRatio: coverageRatio.value,
    horizonDays: horizonDays.value,
  })
  if (res.ok) {
    toast.add({
      title: 'Hoja reconstruida',
      description: `${res.data.lines} línea(s) generadas`,
      color: 'success',
    })
    await load()
  } else {
    toast.add({ title: 'No se pudo reconstruir la hoja', description: res.error?.message, color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Hoja de demanda" :subtitle="`${total} líneas pendientes`">
      <div v-if="canManage" class="flex items-center gap-2">
        <label class="text-sm text-ink/50">Cobertura</label>
        <input
          v-model.number="coverageRatio"
          type="number"
          step="0.1"
          min="1"
          class="input input-sm w-20"
        />
        <label class="text-sm text-ink/50">Días</label>
        <input
          v-model.number="horizonDays"
          type="number"
          step="1"
          min="1"
          class="input input-sm w-20"
        />
        <button class="btn btn-primary btn-sm" type="button" @click="regenerate()">
          Reconstruir
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
    <EmptyState v-else-if="!lines.length" title="Sin líneas de demanda pendientes" />

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Artículo</th>
              <th class="text-right">Cantidad necesaria</th>
              <th>Fecha requerida</th>
              <th>Origen</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in lines" :key="line.id">
              <td>
                <span class="font-mono text-xs text-ink/50">{{ line.itemCode }}</span>
                {{ line.itemDescription }}
              </td>
              <td class="text-right tabular-nums">{{ number(line.quantityNeeded) }}</td>
              <td>{{ date(line.requiredDate) }}</td>
              <td><erp-ErpStatusBadge :status="line.source" /></td>
              <td><erp-ErpStatusBadge :status="line.action" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
