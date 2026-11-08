<script setup lang="ts">
const props = defineProps<{ status: string }>()

const map: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'neutral' }> = {
  draft: { label: 'Borrador', color: 'neutral' },
  pending: { label: 'Pendiente', color: 'warning' },
  approved: { label: 'Aprobada', color: 'success' },
  rejected: { label: 'Rechazada', color: 'error' },
  cancelled: { label: 'Cancelada', color: 'neutral' },
}

const item = computed(() => map[props.status] ?? { label: props.status, color: 'neutral' as const })
</script>

<template>
  <UBadge :color="item.color" variant="subtle" size="sm">{{ item.label }}</UBadge>
</template>
