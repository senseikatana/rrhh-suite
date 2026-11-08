<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

async function submit() {
  error.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/request-password-reset', {
      method: 'POST',
      body: { email: email.value.trim(), redirectTo: '/reset-password' },
    })
    sent.value = true
  } catch (caught) {
    const fetchError = caught as { data?: { message?: string } }
    error.value =
      fetchError?.data?.message ?? 'No se ha podido enviar el correo. Inténtalo de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    title="Recupera tu contraseña"
    subtitle="Te enviaremos un enlace para crear una nueva."
  >
    <div v-if="sent" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <UIcon name="i-lucide-mail-check" class="size-6" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-emerald-900">Revisa tu correo</h3>
      <p class="mt-2 text-sm text-emerald-800">
        Si <strong>{{ email }}</strong> existe en el sistema, recibirás un enlace para
        restablecer la contraseña. Caduca en 1 hora.
      </p>
      <UButton to="/signin" class="mt-5" variant="soft">Volver a iniciar sesión</UButton>
    </div>

    <form v-else class="space-y-4" :data-ready="mounted ? 'true' : 'false'" @submit.prevent="submit">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="forgot-email">
          Email
        </label>
        <UInput
          id="forgot-email"
          v-model="email"
          type="email"
          autocomplete="email"
          icon="i-lucide-mail"
          placeholder="tu@empresa.com"
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
        Enviar enlace
      </UButton>
    </form>

    <p class="mt-4 text-center text-sm text-slate-500">
      <NuxtLink to="/signin" class="font-medium text-sky-600 hover:text-sky-700">
        Volver a iniciar sesión
      </NuxtLink>
    </p>
  </AuthShell>
</template>
