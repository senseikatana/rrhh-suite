<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : '',
)

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const done = ref(false)
const error = ref('')
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

async function submit() {
  error.value = ''

  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  loading.value = true

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { newPassword: password.value, token: token.value },
    })
    done.value = true
  } catch (caught) {
    const fetchError = caught as { data?: { message?: string; code?: string } }
    error.value =
      fetchError?.data?.code === 'INVALID_TOKEN' || fetchError?.data?.code === 'TOKEN_EXPIRED'
        ? 'El enlace no es válido o ha caducado. Solicita uno nuevo.'
        : (fetchError?.data?.message ?? 'No se ha podido cambiar la contraseña.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Nueva contraseña" subtitle="Define una contraseña segura para tu cuenta.">
    <div v-if="!token" class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <UIcon name="i-lucide-link-2-off" class="size-6" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-rose-900">Enlace inválido</h3>
      <p class="mt-2 text-sm text-rose-800">
        Falta el token de recuperación. Solicita un enlace nuevo.
      </p>
      <UButton to="/forgot-password" class="mt-5" variant="soft">Solicitar enlace</UButton>
    </div>

    <div v-else-if="done" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <UIcon name="i-lucide-check" class="size-6" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-emerald-900">Contraseña actualizada</h3>
      <p class="mt-2 text-sm text-emerald-800">Ya puedes iniciar sesión con la nueva contraseña.</p>
      <UButton to="/signin" class="mt-5" variant="soft">Iniciar sesión</UButton>
    </div>

    <form v-else class="space-y-4" :data-ready="mounted ? 'true' : 'false'" @submit.prevent="submit">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="new-password">
          Nueva contraseña
        </label>
        <UInput
          id="new-password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          icon="i-lucide-lock"
          placeholder="Mínimo 8 caracteres"
          size="lg"
          class="w-full"
        />
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="new-password-confirm">
          Repite la contraseña
        </label>
        <UInput
          id="new-password-confirm"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          icon="i-lucide-lock"
          placeholder="••••••••"
          size="lg"
          class="w-full"
        />
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :description="error"
      />

      <UButton type="submit" size="lg" block :loading="loading" :disabled="!mounted">
        Guardar contraseña
      </UButton>
    </form>
  </AuthShell>
</template>
