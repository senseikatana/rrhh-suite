<script setup lang="ts">
const { state, displayName, logout, isManager } = useSession()
const requestFetch = useRequestFetch()
const toast = useToast()

interface SessionRow {
  id?: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string
  expiresAt: string
}

const { data: sessions, refresh: refreshSessions } = await useAsyncData<SessionRow[]>(
  'account-sessions',
  () => requestFetch('/api/auth/list-sessions'),
)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)

const resending = ref(false)
const revokingToken = ref<string | null>(null)

const roleLabel = computed(() => {
  const role = state.value?.user.role
  if (role === 'admin') return 'Administración'
  if (role === 'manager') return 'Mando'
  return 'Empleado'
})

async function changePassword() {
  if (newPassword.value.length < 8) {
    toast.add({ title: 'La contraseña debe tener al menos 8 caracteres', color: 'error' })
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.add({ title: 'Las contraseñas no coinciden', color: 'error' })
    return
  }

  changingPassword.value = true

  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        revokeOtherSessions: true,
      },
    })

    toast.add({ title: 'Contraseña actualizada', color: 'success' })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    await refreshSessions()
  } catch (caught) {
    const error = caught as { data?: { message?: string; code?: string } }
    toast.add({
      title:
        error?.data?.code === 'INVALID_PASSWORD'
          ? 'La contraseña actual no es correcta'
          : 'No se pudo cambiar la contraseña',
      description: error?.data?.message,
      color: 'error',
    })
  } finally {
    changingPassword.value = false
  }
}

async function revokeSession(token: string) {
  revokingToken.value = token

  try {
    await $fetch('/api/auth/revoke-session', { method: 'POST', body: { token } })
    await refreshSessions()
    toast.add({ title: 'Sesión cerrada', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudo cerrar la sesión', color: 'error' })
  } finally {
    revokingToken.value = null
  }
}

async function revokeOthers() {
  try {
    await $fetch('/api/auth/revoke-other-sessions', { method: 'POST' })
    await refreshSessions()
    toast.add({ title: 'Se han cerrado las demás sesiones', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudieron cerrar las sesiones', color: 'error' })
  }
}

async function resendVerification() {
  resending.value = true

  try {
    await $fetch('/api/auth/send-verification-email', {
      method: 'POST',
      body: { email: state.value?.user.email, callbackURL: '/' },
    })
    toast.add({
      title: 'Correo de verificación enviado',
      description: 'Revisa tu bandeja de entrada.',
      color: 'success',
    })
  } catch (caught) {
    const error = caught as { data?: { message?: string } }
    toast.add({
      title: 'No se pudo enviar el correo',
      description: error?.data?.message,
      color: 'error',
    })
  } finally {
    resending.value = false
  }
}

async function signOutEverywhere() {
  try {
    await $fetch('/api/auth/revoke-sessions', { method: 'POST' })
  } catch {
    // Aunque falle el endpoint, se limpia la sesión local.
  }
  await logout()
}

function describeAgent(userAgent: string | null | undefined) {
  if (!userAgent) return 'Dispositivo desconocido'
  if (/iphone|ipad|android/i.test(userAgent)) return 'Móvil o tablet'
  if (/firefox/i.test(userAgent)) return 'Firefox'
  if (/edg/i.test(userAgent)) return 'Edge'
  if (/chrome/i.test(userAgent)) return 'Chrome'
  if (/safari/i.test(userAgent)) return 'Safari'
  return 'Navegador'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Mi cuenta"
      subtitle="Datos de acceso, contraseña y sesiones abiertas."
    >
      <UButton color="neutral" variant="soft" icon="i-lucide-log-out" @click="logout">
        Cerrar sesión
      </UButton>
    </PageHeader>

    <UAlert
      v-if="state && !state.user.emailVerified"
      color="warning"
      variant="subtle"
      icon="i-lucide-mail-warning"
      title="Tu email no está verificado"
      description="Verifica tu dirección para asegurar la cuenta y poder recuperar la contraseña."
    >
      <template #actions>
        <UButton size="sm" color="warning" variant="soft" :loading="resending" @click="resendVerification">
          Reenviar verificación
        </UButton>
      </template>
    </UAlert>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-white">
            {{ displayName.charAt(0) }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900">{{ displayName }}</p>
            <p class="truncate text-xs text-slate-500">{{ state?.user.email }}</p>
          </div>
        </div>

        <dl class="mt-5 space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Rol</dt>
            <dd><UBadge color="neutral" variant="subtle">{{ roleLabel }}</UBadge></dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Email verificado</dt>
            <dd>
              <UBadge
                :color="state?.user.emailVerified ? 'success' : 'warning'"
                variant="subtle"
              >
                {{ state?.user.emailVerified ? 'Sí' : 'Pendiente' }}
              </UBadge>
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Ficha de empleado</dt>
            <dd>
              <UBadge :color="state?.employee ? 'success' : 'neutral'" variant="subtle">
                {{ state?.employee ? 'Vinculada' : 'Sin vincular' }}
              </UBadge>
            </dd>
          </div>
        </dl>

        <p v-if="!state?.employee" class="mt-4 text-xs leading-relaxed text-slate-400">
          Tu usuario no tiene ficha de empleado. Si RRHH importa una ficha con tu mismo email,
          se vinculará automáticamente al registrarte de nuevo o al actualizarla.
        </p>

        <UButton
          v-if="isManager"
          to="/empleados"
          class="mt-4"
          variant="soft"
          icon="i-lucide-users"
        >
          Gestionar plantilla
        </UButton>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <h2 class="text-sm font-semibold text-slate-900">Cambiar contraseña</h2>
        <p class="mt-1 text-xs text-slate-500">
          Al guardar se cerrarán las sesiones abiertas en otros dispositivos.
        </p>

        <form class="mt-5 grid gap-3 sm:grid-cols-2" @submit.prevent="changePassword">
          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700" for="current-password">
              Contraseña actual
            </label>
            <UInput
              id="current-password"
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              icon="i-lucide-lock"
              class="w-full"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700" for="account-new-password">
              Nueva contraseña
            </label>
            <UInput
              id="account-new-password"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              icon="i-lucide-lock"
              placeholder="Mínimo 8 caracteres"
              class="w-full"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700" for="account-confirm-password">
              Repite la nueva
            </label>
            <UInput
              id="account-confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              icon="i-lucide-lock"
              class="w-full"
            />
          </div>

          <div class="sm:col-span-2">
            <UButton type="submit" :loading="changingPassword" icon="i-lucide-key-round">
              Guardar contraseña
            </UButton>
          </div>
        </form>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Sesiones abiertas</h2>
          <p class="text-xs text-slate-500">{{ sessions?.length ?? 0 }} dispositivos con acceso.</p>
        </div>
        <div class="flex gap-2">
          <UButton size="sm" color="neutral" variant="soft" @click="revokeOthers">
            Cerrar las demás
          </UButton>
          <UButton size="sm" color="error" variant="soft" @click="signOutEverywhere">
            Cerrar todas
          </UButton>
        </div>
      </div>

      <div v-if="sessions?.length" class="divide-y divide-slate-100">
        <div
          v-for="session in sessions"
          :key="session.token"
          class="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-center gap-3">
            <span class="rounded-xl bg-slate-100 p-2 text-slate-500">
              <UIcon name="i-lucide-monitor-smartphone" class="size-4" />
            </span>
            <div>
              <p class="text-sm font-medium text-slate-800">{{ describeAgent(session.userAgent) }}</p>
              <p class="text-xs text-slate-400">
                {{ session.ipAddress ?? 'IP desconocida' }} · desde
                {{ formatDate(session.createdAt) }} · caduca {{ formatDate(session.expiresAt) }}
              </p>
            </div>
          </div>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="revokingToken === session.token"
            @click="revokeSession(session.token)"
          >
            Cerrar
          </UButton>
        </div>
      </div>

      <p v-else class="px-6 py-8 text-sm text-slate-500">No hay sesiones registradas.</p>
    </div>
  </div>
</template>
