<script setup lang="ts">
definePageMeta({ layout: false })

const { login } = useSession()

const email = ref('admin@hotelmarina.test')
const password = ref('Admin1234!')
const loading = ref(false)
const error = ref('')
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

const demoAccounts = [
  { label: 'Administración', email: 'admin@hotelmarina.test', password: 'Admin1234!' },
  { label: 'Mando', email: 'manager@hotelmarina.test', password: 'Manager1234!' },
  { label: 'Empleado', email: 'empleado@hotelmarina.test', password: 'Empleado1234!' },
]

function useAccount(account: (typeof demoAccounts)[number]) {
  email.value = account.email
  password.value = account.password
  error.value = ''
}

async function submit() {
  error.value = ''
  loading.value = true

  try {
    await login(email.value, password.value)
    await navigateTo('/')
  } catch (caught) {
    const fetchError = caught as { data?: { message?: string; code?: string } }
    error.value =
      fetchError?.data?.code === 'EMAIL_NOT_VERIFIED'
        ? 'Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.'
        : (fetchError?.data?.message ??
          'No se ha podido iniciar sesión. Revisa el email y la contraseña.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Inicia sesión" subtitle="Accede con tu cuenta de la empresa.">
    <form class="space-y-4" :data-ready="mounted ? 'true' : 'false'" @submit.prevent="submit">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="email">Email</label>
        <UInput
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          icon="i-lucide-mail"
          placeholder="tu@empresa.com"
          size="lg"
          class="w-full"
        />
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="block text-sm font-medium text-slate-700" for="password">Contraseña</label>
          <NuxtLink
            to="/forgot-password"
            class="text-xs font-medium text-sky-600 hover:text-sky-700"
          >
            ¿La has olvidado?
          </NuxtLink>
        </div>
        <UInput
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
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
        Entrar
      </UButton>
    </form>

    <p class="mt-4 text-center text-sm text-slate-500">
      ¿No tienes cuenta?
      <NuxtLink to="/signup" class="font-medium text-sky-600 hover:text-sky-700">
        Crear una cuenta
      </NuxtLink>
    </p>

    <div class="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Cuentas de demostración
      </p>
      <div class="mt-3 space-y-2">
        <button
          v-for="account in demoAccounts"
          :key="account.email"
          type="button"
          class="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
          @click="useAccount(account)"
        >
          <div>
            <p class="text-sm font-medium text-slate-900">{{ account.label }}</p>
            <p class="text-xs text-slate-500">{{ account.email }}</p>
          </div>
          <UIcon name="i-lucide-chevron-right" class="size-4 text-slate-400" />
        </button>
      </div>
      <p class="mt-3 text-[11px] leading-relaxed text-slate-400">
        Datos de ejemplo de un hotel de 25 empleados. No uses estas cuentas en producción.
      </p>
    </div>
  </AuthShell>
</template>
