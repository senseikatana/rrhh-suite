<script setup lang="ts">
import type { Kpi } from '~/types/erp'

const props = defineProps<{ kpi: Kpi }>()

const { number } = useErpFormat()

const labels: Record<Kpi['key'], string> = {
  order_accuracy: 'Precisión de pedidos',
  picks_per_hour: 'Picks por hora',
  dock_to_stock: 'Muelle a stock',
  inventory_turnover: 'Rotación de inventario',
}

const label = computed(() => labels[props.kpi.key] ?? props.kpi.key)
const display = computed(() =>
  props.kpi.value === null ? 'Sin datos' : `${number(props.kpi.value, 1)} ${props.kpi.unit}`,
)
</script>

<template>
  <div class="card">
    <div class="card-body gap-1">
      <p class="text-xs text-ink/50">{{ label }}</p>
      <p class="text-2xl font-semibold tabular-nums">{{ display }}</p>
    </div>
  </div>
</template>
