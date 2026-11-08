<script setup lang="ts">
defineProps<{
  title: string
  phase: string
  description: string
  features: string[]
}>()
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="title" :subtitle="description">
      <UBadge color="neutral" variant="subtle">{{ phase }}</UBadge>
      <UButton to="/" color="neutral" variant="ghost" icon="i-lucide-arrow-left">Volver al inicio</UButton>
    </PageHeader>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="rounded-xl bg-amber-100 p-2 text-amber-700">
            <UIcon name="i-lucide-hammer" class="size-5" />
          </span>
          <div>
            <p class="text-sm font-semibold text-slate-900">Módulo planificado</p>
            <p class="text-xs text-slate-500">La navegación y el modelo de datos ya están preparados.</p>
          </div>
        </div>

        <ul class="mt-5 space-y-2">
          <li v-for="feature in features" :key="feature" class="flex items-start gap-2 text-sm text-slate-600">
            <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>{{ feature }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-slate-300 shadow-sm">
        <p class="text-sm font-semibold text-white">Estado del proyecto</p>
        <p class="mt-2 text-sm">
          La primera entrega cubre <strong class="text-white">vacaciones y ausencias</strong> de punta a punta.
          Este módulo se implementa sobre la misma base de datos, autenticación y diseño.
        </p>
        <div class="mt-5 space-y-3 text-sm">
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <span>F0 · Núcleo, auth y seed</span>
            <UBadge color="success" variant="subtle">Completado</UBadge>
          </div>
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <span>F1 · Vacaciones y ausencias</span>
            <UBadge color="success" variant="subtle">Completado</UBadge>
          </div>
          <div class="flex items-center justify-between">
            <span>{{ phase }} · {{ title }}</span>
            <UBadge color="warning" variant="subtle">Siguiente</UBadge>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
