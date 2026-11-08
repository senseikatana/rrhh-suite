<script setup lang="ts">
const props = defineProps<{ status: string }>()

const map: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'neutral' | 'info' }> = {
  // Ventas
  OPEN: { label: 'Abierto', color: 'info' },
  PICKING: { label: 'Preparando', color: 'warning' },
  SHIPPED: { label: 'Enviado', color: 'success' },
  INVOICED: { label: 'Facturado', color: 'neutral' },
  CANCELLED: { label: 'Cancelado', color: 'error' },
  // Compras
  RECEIVED: { label: 'Recibido', color: 'info' },
  QC_PENDING: { label: 'En calidad', color: 'warning' },
  QC_APPROVED: { label: 'Calidad OK', color: 'success' },
  REJECTED: { label: 'Rechazado', color: 'error' },
  CLOSED: { label: 'Cerrado', color: 'neutral' },
  // Calidad de línea
  PENDING: { label: 'Pendiente', color: 'warning' },
  PASSED: { label: 'Aprobado', color: 'success' },
  FAILED: { label: 'Fallido', color: 'error' },
  // Rutas
  PLANNED: { label: 'Planificada', color: 'info' },
  IN_TRANSIT: { label: 'En tránsito', color: 'warning' },
  DELIVERED: { label: 'Entregada', color: 'success' },
  // Demanda
  ORDERED: { label: 'Pedido', color: 'success' },
  IGNORED: { label: 'Ignorado', color: 'neutral' },
  // Origen de demanda
  SALES_ORDER: { label: 'Pedido de venta', color: 'info' },
  MIN_STOCK: { label: 'Stock mínimo', color: 'warning' },
  FORECAST: { label: 'Previsión', color: 'neutral' },
}

const item = computed(() => map[props.status] ?? { label: props.status, color: 'neutral' as const })
</script>

<template>
  <UBadge :color="item.color" variant="subtle" size="sm">{{ item.label }}</UBadge>
</template>
