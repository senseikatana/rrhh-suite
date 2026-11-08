<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  { icon: 'i-lucide-inbox', description: '' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
    <span class="rounded-2xl bg-slate-100 p-3 text-slate-500">
      <UIcon :name="icon" class="size-6" />
    </span>
    <p class="mt-4 text-sm font-semibold text-slate-900">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-slate-500">{{ description }}</p>
    <div class="mt-4">
      <slot />
    </div>
  </div>
</template>
