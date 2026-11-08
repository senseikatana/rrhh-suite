import { getContext } from '../utils/hr'

export default defineEventHandler(async (event) => {
  const { user, employee, org, settings } = await getContext(event)

  return {
    user,
    employee: employee ?? null,
    organization: { id: org.id, name: org.name, slug: org.slug, timezone: org.timezone },
    settings: {
      vacationMode: settings.vacationMode,
      annualVacationDays: settings.annualVacationDays,
      minNoticeDays: settings.minNoticeDays,
      workweek: settings.workweek,
      overtimeHoursPerDay: settings.overtimeHoursPerDay,
    },
  }
})
