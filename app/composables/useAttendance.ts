import type { AttendanceStatus } from '~/types/attendance'

export function useAttendance(key = 'attendance-status') {
  const requestFetch = useRequestFetch()

  const {
    data: status,
    refresh,
    error,
  } = useAsyncData<AttendanceStatus>(key, () => requestFetch('/api/attendance/status'))

  const clocking = ref(false)
  const now = ref<Date | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    now.value = new Date()
    timer = setInterval(() => {
      now.value = new Date()
    }, 1000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const liveElapsed = computed(() => {
    if (!status.value?.openSince || !now.value) return 0
    return minutesSince(status.value.openSince, now.value)
  })

  const extraMinutes = computed(() => {
    if (!status.value?.clockedIn) return 0
    return Math.max(0, liveElapsed.value - status.value.elapsedMinutes)
  })

  const workedToday = computed(() => (status.value?.workedTodayMinutes ?? 0) + extraMinutes.value)
  const balanceToday = computed(() => (status.value?.balanceTodayMinutes ?? 0) + extraMinutes.value)

  const nextDirection = computed<'in' | 'out'>(() => (status.value?.clockedIn ? 'out' : 'in'))

  async function clock(direction?: 'in' | 'out') {
    clocking.value = true
    try {
      status.value = await $fetch<AttendanceStatus>('/api/attendance/clock', {
        method: 'POST',
        body: direction ? { direction } : {},
      })
      return status.value
    } finally {
      clocking.value = false
    }
  }

  return {
    status,
    refresh,
    error,
    clocking,
    clock,
    now,
    liveElapsed,
    workedToday,
    balanceToday,
    nextDirection,
  }
}
