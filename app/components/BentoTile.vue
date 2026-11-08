<script setup lang="ts">
/**
 * Pieza reutilizable del bento grid.
 *
 * El atractivo de un bento está en la asimetría: cada tile ocupa un span
 * distinto (`size`) para formar un mosaico. `accent` invierte los colores para
 * crear ritmo visual, y `to` convierte la pieza en un enlace a un módulo.
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
    to?: string
    /** Span de la pieza en el grid. */
    size?: 'sm' | 'wide' | 'tall' | 'hero'
    /** Tile oscuro de acento. */
    accent?: boolean
    /** Chip de fase (F2/F3/F4) o estado. */
    badge?: string
    /** Dato vivo destacado (opcional). */
    value?: string | number
    hint?: string
    tone?: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate'
  }>(),
  {
    size: 'sm',
    accent: false,
    description: '',
    icon: '',
    to: '',
    badge: '',
    value: '',
    hint: '',
    tone: 'sky',
  },
)

const tones: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
}

const spans: Record<string, string> = {
  sm: 'sm:col-span-1',
  wide: 'sm:col-span-2',
  tall: 'sm:col-span-1 sm:row-span-2',
  hero: 'sm:col-span-2 sm:row-span-2',
}

const toneClass = computed(() => tones[props.tone])
const spanClass = computed(() => spans[props.size])

const NuxtLinkComponent = resolveComponent('NuxtLink')
const tag = computed(() => (props.to ? NuxtLinkComponent : 'div'))

const baseClass = computed(() =>
  props.accent
    ? 'bg-slate-900 text-white border-slate-800'
    : 'bg-white text-slate-900 border-slate-200',
)
</script>

<template>
  <component
    :is="tag"
    :to="to || undefined"
    class="group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200"
    :class="[
      spanClass,
      baseClass,
      to ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : '',
    ]"
  >
    <!-- Encabezado: icono + badge -->
    <div class="flex items-start justify-between gap-3">
      <span
        v-if="icon"
        class="rounded-xl p-2 transition"
        :class="accent ? 'bg-white/10 text-white' : toneClass"
      >
        <UIcon :name="icon" class="size-5" />
      </span>
      <span
        v-if="badge"
        class="rounded-md px-2 py-0.5 text-[10px] font-semibold"
        :class="accent ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'"
      >
        {{ badge }}
      </span>
    </div>

    <!-- Cuerpo -->
    <div class="mt-4">
      <p
        v-if="value !== ''"
        class="text-3xl font-semibold tracking-tight"
        :class="accent ? 'text-white' : 'text-slate-900'"
      >
        {{ value }}
      </p>
      <p class="mt-1 text-sm font-semibold" :class="accent ? 'text-white' : 'text-slate-900'">
        {{ title }}
      </p>
      <p
        v-if="description"
        class="mt-1 text-xs"
        :class="accent ? 'text-slate-400' : 'text-slate-500'"
      >
        {{ description }}
      </p>
      <p v-if="hint" class="mt-1 text-xs" :class="accent ? 'text-slate-400' : 'text-slate-500'">
        {{ hint }}
      </p>
    </div>

    <!-- Flecha en enlaces -->
    <UIcon
      v-if="to"
      name="i-lucide-arrow-up-right"
      class="absolute bottom-4 right-4 size-4 transition"
      :class="accent ? 'text-slate-500 group-hover:text-white' : 'text-slate-300 group-hover:text-slate-500'"
    />

    <!-- Slot para contenido libre -->
    <slot />
  </component>
</template>
