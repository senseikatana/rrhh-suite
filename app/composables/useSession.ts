export interface SessionUser {
  id: string
  name: string
  email: string
  emailVerified?: boolean
  role: 'admin' | 'manager' | 'employee'
}

export interface SessionEmployee {
  id: string
  orgId: string
  departmentId: string | null
  userId: string | null
  firstName: string
  lastName: string
  email: string
  position: string | null
  startDate: string
  weeklyHours: number
}

export interface SessionOrganization {
  id: string
  name: string
  slug: string
  timezone: string
}

export interface SessionSettings {
  vacationMode: 'natural' | 'working'
  annualVacationDays: number
  minNoticeDays: number
  workweek: number[]
  overtimeHoursPerDay: number
}

export interface SessionState {
  user: SessionUser
  employee: SessionEmployee | null
  organization: SessionOrganization
  settings: SessionSettings
}

export function useSession() {
  const state = useState<SessionState | null>('session-state', () => null)
  const loaded = useState<boolean>('session-loaded', () => false)
  const requestFetch = useRequestFetch()

  async function refresh() {
    try {
      state.value = await requestFetch<SessionState>('/api/me')
    } catch {
      state.value = null
    } finally {
      loaded.value = true
    }
    return state.value
  }

  async function login(email: string, password: string) {
    await $fetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
    })
    await refresh()
  }

  async function logout() {
    try {
      await $fetch('/api/auth/sign-out', { method: 'POST' })
    } catch {
      // La sesión local se limpia igualmente.
    }
    state.value = null
    await navigateTo('/signin')
  }

  const isAdmin = computed(() => state.value?.user.role === 'admin')
  const isManager = computed(
    () => state.value?.user.role === 'admin' || state.value?.user.role === 'manager',
  )

  const displayName = computed(() => {
    if (state.value?.employee) {
      return `${state.value.employee.firstName} ${state.value.employee.lastName}`
    }
    return state.value?.user.name ?? ''
  })

  return { state, loaded, refresh, login, logout, isAdmin, isManager, displayName }
}
