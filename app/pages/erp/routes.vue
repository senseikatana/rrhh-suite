<script setup lang="ts">
import type { ErpRoute, Page } from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const session = useErpSession()
const { date, number } = useErpFormat()
const toast = useToast()

const routes = ref<ErpRoute[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

const canManage = computed(() => session.hasRole('admin', 'logistics'))

// Formulario de alta
const form = ref({ code: '', carrier: '', date: '', stops: 0 })
const showForm = ref(false)

async function load() {
  loading.value = true
  const res = await api.get<Page<ErpRoute>>('routes', { query: { limit: 100 } })
  if (res.ok) {
    routes.value = res.data.items
    total.value = res.data.meta.total
    error.value = null
  } else {
    error.value = res.error?.message ?? 'No se pudieron cargar las rutas'
  }
  loading.value = false
}

onMounted(async () => {
  await session.refresh()
  await load()
})

async function createRoute() {
  if (!form.value.code || !form.value.carrier || !form.value.date) {
    toast.add({ title: 'Faltan datos', description: 'Código, transportista y fecha son obligatorios.', color: 'warning' })
    return
  }
  const res = await api.post<ErpRoute>('routes', { ...form.value })
  if (res.ok) {
    toast.add({ title: 'Ruta creada', description: `${form.value.code} · ${form.value.carrier}`, color: 'success' })
    showForm.value = false
    form.value = { code: '', carrier: '', date: '', stops: 0 }
    await load()
  } else {
    toast.add({ title: 'No se pudo crear la ruta', description: res.error?.message, color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Rutas de transporte" :subtitle="`${total} rutas`">
      <button v-if="canManage" class="btn btn-primary btn-sm" type="button" @click="showForm = !showForm">
        Nueva ruta
      </button>
    </PageHeader>

    <div v-if="showForm" class="card">
      <div class="card-body grid grid-cols-1 gap-3 md:grid-cols-4">
        <input v-model="form.code" type="text" class="input" placeholder="Código" />
        <input v-model="form.carrier" type="text" class="input" placeholder="Transportista" />
        <input v-model="form.date" type="date" class="input" />
        <div class="flex items-center gap-2">
          <input v-model.number="form.stops" type="number" class="input w-24" min="0" />
          <button class="btn btn-primary" type="button" @click="createRoute()">Crear</button>
        </div>
      </div>
    </div>

    <p v-if="loading" class="text-sm text-ink/60">Cargando…</p>
    <div v-else-if="error" class="card">
      <div class="card-body items-start gap-3">
        <p class="text-sm text-ink/60">{{ error }}</p>
        <button class="btn btn-sm" type="button" @click="load()">Reintentar</button>
      </div>
    </div>
    <EmptyState v-else-if="!routes.length" title="Sin rutas registradas" />

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Transportista</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th class="text-right">Paradas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="route in routes" :key="route.id">
              <td class="font-mono text-xs whitespace-nowrap">{{ route.code }}</td>
              <td>{{ route.carrier }}</td>
              <td>{{ date(route.date) }}</td>
              <td><erp-ErpStatusBadge :status="route.status" /></td>
              <td class="text-right tabular-nums">{{ number(route.stops) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
