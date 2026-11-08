<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    icon?: string
    tone?: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose'
  }>(),
  { tone: 'sky', hint: '', icon: '' },
)

const tones = {
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
}

const toneClass = computed(() => tones[props.tone])
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-medium text-slate-500">{{ label }}</p>
      <span v-if="icon" class="rounded-xl p-2" :class="toneClass">
        <UIcon :name="icon" class="size-5" />
      </span>
    </div>
    <p class="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
