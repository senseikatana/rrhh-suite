<script setup lang="ts">
import type { Item, Page } from '~/types/erp'

definePageMeta({ layout: 'default' })

const api = useErpApi()
const session = useErpSession()
const { money, number } = useErpFormat()
const toast = useToast()

const items = ref<Item[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const belowMinimum = ref(false)

async function load() {
  loading.value = true
  const res = await api.get<Page<Item>>('items', {
    query: {
      limit: 200,
      ...(search.value ? { search: search.value } : {}),
      ...(belowMinimum.value ? { below_minimum: 'true' } : {}),
    },
  })
  if (res.ok) {
    items.value = res.data.items
    total.value = res.data.meta.total
    error.value = null
  } else {
    error.value = res.error?.message ?? 'No se pudieron cargar los artículos'
  }
  loading.value = false
}

onMounted(async () => {
  await session.refresh()
  await load()
})

type Adjustment = { item: Item; quantity: number; reason: string } | null
const adjusting = ref<Adjustment>(null)

function openAdjustment(item: Item) {
  adjusting.value = { item, quantity: 0, reason: '' }
}

async function submitAdjustment() {
  if (!adjusting.value) return
  const { item, quantity, reason } = adjusting.value

  if (!reason.trim()) {
    toast.add({ title: 'Falta el motivo', description: 'El motivo del ajuste es obligatorio.', color: 'warning' })
    return
  }

  const res = await api.post<Item>(
    'itemAdjust',
    { quantity, reason: reason.trim() },
    { params: { id: item.id } },
  )
  if (res.ok) {
    toast.add({ title: 'Stock ajustado', description: `${item.code} · ${quantity > 0 ? '+' : ''}${quantity}`, color: 'success' })
    adjusting.value = null
    await load()
  } else {
    toast.add({ title: 'No se pudo ajustar el stock', description: res.error?.message, color: 'error' })
  }
}

function stockTone(item: Item): 'ok' | 'near' | 'low' {
  const stock = Number(item.stock)
  const min = Number(item.minStock)
  if (stock < min) return 'low'
  if (min > 0 && stock < min * 1.5) return 'near'
  return 'ok'
}

// Clases estáticas para que Tailwind detecte cada variante en build.
const toneClasses: Record<'ok' | 'near' | 'low', string> = {
  ok: 'badge badge-soft badge-success',
  near: 'badge badge-soft badge-warning',
  low: 'badge badge-soft badge-error',
}
const toneLabels: Record<'ok' | 'near' | 'low', string> = {
  ok: 'Correcto',
  near: 'Cerca del mínimo',
  low: 'Bajo mínimo',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Almacén" :subtitle="`${total} artículos`">
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="search"
          type="search"
          class="input w-full sm:w-64"
          placeholder="Buscar por código o descripción"
          @keyup.enter="load()"
        />
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input v-model="belowMinimum" type="checkbox" class="checkbox checkbox-sm" @change="load()" />
          Solo bajo mínimo
        </label>
      </div>
    </PageHeader>

    <p v-if="loading" class="text-sm text-ink/60">Cargando…</p>
    <div v-else-if="error" class="card">
      <div class="card-body items-start gap-3">
        <p class="text-sm text-ink/60">{{ error }}</p>
        <button class="btn btn-sm" type="button" @click="load()">Reintentar</button>
      </div>
    </div>
    <EmptyState v-else-if="!items.length" title="Sin artículos" />

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Ubicación</th>
              <th class="text-right">Stock</th>
              <th class="text-right">Mínimo</th>
              <th class="text-right">Coste</th>
              <th>Estado</th>
              <th v-if="session.hasRole('admin', 'logistics')"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td class="font-mono text-xs whitespace-nowrap">{{ item.code }}</td>
              <td>{{ item.description }}</td>
              <td class="text-ink/60">{{ item.category ?? '—' }}</td>
              <td class="font-mono text-xs">{{ item.location }}</td>
              <td class="text-right tabular-nums">{{ number(item.stock) }}</td>
              <td class="text-right tabular-nums">{{ number(item.minStock) }}</td>
              <td class="text-right tabular-nums">{{ money(item.unitCost) }}</td>
              <td>
                <span :class="toneClasses[stockTone(item)]">{{ toneLabels[stockTone(item)] }}</span>
              </td>
              <td v-if="session.hasRole('admin', 'logistics')" class="text-right">
                <button class="btn btn-sm" type="button" @click="openAdjustment(item)">Ajustar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Diálogo de ajuste de stock -->
    <div
      v-if="adjusting"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      @click.self="adjusting = null"
    >
      <div class="w-full max-w-md rounded-2xl bg-white shadow-xl" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 class="text-lg font-semibold">Ajustar stock</h2>
          <button class="btn btn-sm" type="button" @click="adjusting = null">✕</button>
        </div>

        <div class="flex flex-col gap-3 px-5 py-4">
          <p class="font-mono text-sm text-ink/60">
            {{ adjusting.item.code }} · {{ adjusting.item.description }}
          </p>
          <p class="text-sm">
            Stock: <strong class="tabular-nums">{{ number(adjusting.item.stock) }}</strong>
          </p>

          <div>
            <label class="label-text" for="adjust-qty">Cantidad</label>
            <input
              id="adjust-qty"
              v-model.number="adjusting.quantity"
              class="input w-full"
              type="number"
              step="1"
            />
            <span class="helper-text">Los valores negativos reducen el stock.</span>
          </div>

          <div>
            <label class="label-text" for="adjust-reason">Motivo</label>
            <input id="adjust-reason" v-model="adjusting.reason" class="input w-full" type="text" />
            <span class="helper-text">Cada ajuste queda registrado con su justificación.</span>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button class="btn" type="button" @click="adjusting = null">Cancelar</button>
          <button class="btn btn-primary" type="button" @click="submitAdjustment">Guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>
