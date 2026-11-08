import { getContext } from '../../utils/hr'
import { getHolidayDates } from '../../utils/leave'

export default defineEventHandler(async (event) => {
  const { db, org } = await getContext(event)
  const query = getQuery(event)
  const year = Number(query.year ?? new Date().getFullYear())

  const dates = await getHolidayDates(db, org.id, year)

  return { year, dates, count: dates.length }
})
