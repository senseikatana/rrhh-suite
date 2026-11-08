<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <aside class="relative hidden overflow-hidden bg-slate-900 p-12 lg:flex lg:flex-col lg:justify-between">
      <div class="absolute -right-32 -top-32 size-96 rounded-full bg-sky-500/20 blur-3xl" />
      <div class="absolute -bottom-40 -left-24 size-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <div class="relative flex items-center gap-3">
        <span class="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-white shadow-lg">
          RR
        </span>
        <div>
          <p class="text-sm font-semibold text-white">RRHH Suite</p>
          <p class="text-xs text-slate-400">Gestión de personas para hoteles</p>
        </div>
      </div>

      <div class="relative max-w-md">
        <h1 class="text-4xl font-semibold leading-tight tracking-tight text-white">
          Vacaciones, ausencias y turnos en un solo lugar.
        </h1>
        <p class="mt-4 text-base leading-relaxed text-slate-400">
          Saldos, bolsa de horas, aprobaciones desde el móvil y calendario anual.
          Funciona en local y se respalda en la nube.
        </p>

        <div class="mt-8 grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-white/10 bg-white/5 p-4">
            <UIcon name="i-lucide-palmtree" class="size-5 text-sky-400" />
            <p class="mt-2 text-sm font-medium text-white">Vacaciones</p>
            <p class="text-xs text-slate-400">Saldo, festivos y solapes</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-white/5 p-4">
            <UIcon name="i-lucide-clock" class="size-5 text-indigo-400" />
            <p class="mt-2 text-sm font-medium text-white">Bolsa de horas</p>
            <p class="text-xs text-slate-400">Compensa horas extra</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-white/5 p-4">
            <UIcon name="i-lucide-file-spreadsheet" class="size-5 text-emerald-400" />
            <p class="mt-2 text-sm font-medium text-white">Excel</p>
            <p class="text-xs text-slate-400">Importa y exporta</p>
          </div>
          <div class="rounded-xl border border-white/10 bg-white/5 p-4">
            <UIcon name="i-lucide-shield-check" class="size-5 text-amber-400" />
            <p class="mt-2 text-sm font-medium text-white">PostgreSQL</p>
            <p class="text-xs text-slate-400">Neon, backups gestionados</p>
          </div>
        </div>
      </div>

      <p class="relative text-xs text-slate-500">RRHH Suite · Fase 1 · Vacaciones y ausencias</p>
    </aside>

    <main class="flex items-center justify-center bg-slate-50 px-4 py-12">
      <div class="w-full max-w-sm">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-white">
            RR
          </span>
          <div>
            <p class="text-sm font-semibold text-slate-900">RRHH Suite</p>
            <p class="text-xs text-slate-500">Gestión de personas</p>
          </div>
        </div>

        <h2 class="text-2xl font-semibold tracking-tight text-slate-900">{{ title }}</h2>
        <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>

        <div class="mt-8">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
