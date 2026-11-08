<script setup lang="ts">
definePageMeta({ layout: false })

const { refresh } = useSession()
const config = useRuntimeConfig()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

const requireVerification = computed(() => Boolean(config.public.requireEmailVerification))

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
    await $fetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
      },
    })

    if (requireVerification.value) {
      await $fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {})
      done.value = true
      return
    }

    await refresh()
    await navigateTo('/')
  } catch (caught) {
    const fetchError = caught as { data?: { message?: string; code?: string } }
    error.value =
      fetchError?.data?.code === 'USER_ALREADY_EXISTS'
        ? 'Ya existe una cuenta con ese email. Prueba a iniciar sesión.'
        : (fetchError?.data?.message ?? 'No se ha podido crear la cuenta. Inténtalo de nuevo.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Crea tu cuenta" subtitle="Regístrate con tu email corporativo.">
    <div
      v-if="done"
      class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
    >
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <UIcon name="i-lucide-mail-check" class="size-6" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-emerald-900">Revisa tu correo</h3>
      <p class="mt-2 text-sm text-emerald-800">
        Hemos enviado un enlace de verificación a <strong>{{ email }}</strong>.
        Al confirmarlo podrás iniciar sesión.
      </p>
      <UButton to="/signin" class="mt-5" variant="soft">Ir a iniciar sesión</UButton>
    </div>

    <form v-else class="space-y-4" :data-ready="mounted ? 'true' : 'false'" @submit.prevent="submit">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="name">Nombre</label>
        <UInput
          id="name"
          v-model="name"
          autocomplete="name"
          icon="i-lucide-user"
          placeholder="Nombre y apellidos"
          size="lg"
          class="w-full"
        />
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="signup-email">
          Email
        </label>
        <UInput
          id="signup-email"
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
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="signup-password">
          Contraseña
        </label>
        <UInput
          id="signup-password"
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
        <label class="mb-1.5 block text-sm font-medium text-slate-700" for="signup-confirm">
          Repite la contraseña
        </label>
        <UInput
          id="signup-confirm"
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
        Crear cuenta
      </UButton>
    </form>

    <p class="mt-4 text-center text-sm text-slate-500">
      ¿Ya tienes cuenta?
      <NuxtLink to="/signin" class="font-medium text-sky-600 hover:text-sky-700">
        Iniciar sesión
      </NuxtLink>
    </p>

    <p class="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
      La primera cuenta de una instalación nueva recibe el rol de administración.
      El resto se crea como empleado y puede vincularse a una ficha por email.
    </p>
  </AuthShell>
</template>
