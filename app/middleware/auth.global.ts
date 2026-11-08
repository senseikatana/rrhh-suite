const PUBLIC_PATHS = new Set([
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
])

/** Rutas que deben seguir accesibles aunque haya sesión iniciada. */
const ALWAYS_ACCESSIBLE = new Set(['/reset-password', '/verify-email'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { state, loaded, refresh } = useSession()

  if (!loaded.value) {
    await refresh()
  }

  if (PUBLIC_PATHS.has(to.path)) {
    if (state.value && !ALWAYS_ACCESSIBLE.has(to.path)) {
      return navigateTo('/')
    }
    return
  }

  if (!state.value) {
    return navigateTo('/signin')
  }
})
