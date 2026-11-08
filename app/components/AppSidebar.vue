<script setup lang="ts">
import type { NavSection } from '~/types/nav'

defineProps<{ sections: NavSection[] }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const { state, displayName, logout } = useSession()

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const roleLabel = computed(() => {
  const role = state.value?.user.role
  if (role === 'admin') return 'Administración'
  if (role === 'manager') return 'Mando'
  return 'Empleado'
})
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-3 px-2">
      <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-white shadow-lg shadow-sky-500/20">
        RR
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-white">RRHH Suite</p>
        <p class="truncate text-xs text-slate-400">{{ state?.organization.name }}</p>
      </div>
    </div>

    <nav class="mt-8 flex-1 space-y-7 overflow-y-auto pb-6">
      <div v-for="section in sections" :key="section.title">
        <p class="px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {{ section.title }}
        </p>
        <div class="mt-2 space-y-1">
          <NuxtLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="
              isActive(item.to)
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            "
            @click="emit('navigate')"
          >
            <UIcon :name="item.icon" class="size-5 shrink-0" />
            <span class="flex-1 truncate">{{ item.label }}</span>
            <UBadge v-if="item.badge" color="warning" variant="solid" size="xs">
              {{ item.badge }}
            </UBadge>
            <span
              v-else-if="item.phase"
              class="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
            >
              {{ item.phase }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <div class="border-t border-white/10 pt-4">
      <div class="flex items-center gap-2 px-2">
        <NuxtLink
          to="/cuenta"
          class="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-80"
          @click="emit('navigate')"
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
            {{ displayName.charAt(0) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">{{ displayName }}</p>
            <p class="truncate text-xs text-slate-400">{{ roleLabel }}</p>
          </div>
        </NuxtLink>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Cerrar sesión"
          @click="logout"
        >
          <UIcon name="i-lucide-log-out" class="size-4" />
        </button>
      </div>
    </div>
  </div>
</template>
