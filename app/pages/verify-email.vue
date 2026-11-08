<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { refresh, state } = useSession()

const status = ref<'loading' | 'ok' | 'error'>('loading')
const message = ref('')

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''

  if (!token) {
    status.value = 'error'
    message.value = 'Falta el token de verificación.'
    return
  }

  try {
    await $fetch('/api/auth/verify-email', { query: { token } })
    status.value = 'ok'
    await refresh()
  } catch (caught) {
    const fetchError = caught as { data?: { message?: string; code?: string } }
    status.value = 'error'
    message.value =
      fetchError?.data?.code === 'TOKEN_EXPIRED'
        ? 'El enlace ha caducado. Solicita uno nuevo desde tu cuenta.'
        : 'El enlace no es válido o ya se ha usado.'
  }
})
</script>

<template>
  <AuthShell title="Verificación de email" subtitle="Estamos confirmando tu dirección de correo.">
    <div v-if="status === 'loading'" class="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <UIcon name="i-lucide-loader-circle" class="mx-auto size-8 animate-spin text-sky-600" />
      <p class="mt-4 text-sm text-slate-500">Verificando…</p>
    </div>

    <div v-else-if="status === 'ok'" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <UIcon name="i-lucide-badge-check" class="size-6" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-emerald-900">Email verificado</h3>
      <p class="mt-2 text-sm text-emerald-800">Tu cuenta ya está activa.</p>
      <UButton :to="state ? '/' : '/signin'" class="mt-5" variant="soft">
        {{ state ? 'Ir al panel' : 'Iniciar sesión' }}
      </UButton>
    </div>

    <div v-else class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <UIcon name="i-lucide-circle-alert" class="size-6" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-rose-900">No se pudo verificar</h3>
      <p class="mt-2 text-sm text-rose-800">{{ message }}</p>
      <div class="mt-5 flex justify-center gap-2">
        <UButton to="/signin" variant="soft">Iniciar sesión</UButton>
        <UButton to="/cuenta" variant="ghost">Mi cuenta</UButton>
      </div>
    </div>
  </AuthShell>
</template>
