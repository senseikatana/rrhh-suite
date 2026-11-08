<script setup lang="ts">
import type { ActivityEvent, Page } from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const session = useErpSession()
const { dateTime } = useErpFormat()

const events = ref<ActivityEvent[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  const res = await api.get<Page<ActivityEvent>>('activity', { query: { limit: 50 } })
  if (res.ok) {
    events.value = res.data.items
    error.value = null
  } else {
    error.value = res.error?.message ?? 'No se pudo cargar la actividad'
  }
  loading.value = false
}

onMounted(async () => {
  await session.refresh()
  await load()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Actividad" subtitle="Registro de cambios recientes" />

    <p v-if="loading" class="text-sm text-ink/60">Cargando…</p>
    <div v-else-if="error" class="card">
      <div class="card-body items-start gap-3">
        <p class="text-sm text-ink/60">{{ error }}</p>
        <button class="btn btn-sm" type="button" @click="load()">Reintentar</button>
      </div>
    </div>
    <EmptyState v-else-if="!events.length" title="Sin eventos registrados" />

    <div v-else class="card">
      <div class="card-body">
        <ul class="divide-y divide-slate-200">
          <li v-for="event in events" :key="event.id" class="py-2 first:pt-0 last:pb-0">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-semibold">{{ event.actorUsername }}</span>
              <span class="text-xs whitespace-nowrap text-ink/50">{{ dateTime(event.occurredAt) }}</span>
            </div>
            <p class="mt-0.5 flex items-baseline gap-1.5 text-sm">
              <span class="font-mono text-xs text-ink/50">{{ event.entity }}</span>
              <span class="font-medium">{{ event.action }}</span>
            </p>
            <p v-if="event.summary" class="mt-0.5 text-xs text-ink/50">{{ event.summary }}</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
