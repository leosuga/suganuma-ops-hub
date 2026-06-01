import type { AnnualEventInsert } from "@/lib/types"

export function generateRecurringEvents(base: AnnualEventInsert): AnnualEventInsert[] {
  const events: AnnualEventInsert[] = [base]
  if (!base.recurrence || base.recurrence === "none") return events

  const start = new Date(base.start_date + "T00:00:00")
  const end = new Date(base.end_date + "T00:00:00")
  const duration = end.getTime() - start.getTime()
  const year = start.getFullYear()

  // Generate a series UUID for all clones
  const seriesId = generateUUID()
  events[0].series_id = seriesId

  if (base.recurrence === "weekly") {
    for (let i = 1; i <= 52; i++) {
      const nextStart = new Date(start)
      nextStart.setDate(start.getDate() + i * 7)
      if (nextStart.getFullYear() > year) break
      const nextEnd = new Date(nextStart.getTime() + duration)
      events.push({
        ...base,
        start_date: nextStart.toISOString().slice(0, 10),
        end_date: nextEnd.toISOString().slice(0, 10),
        series_id: seriesId,
      })
    }
  } else if (base.recurrence === "monthly") {
    for (let i = 1; i < 12; i++) {
      const nextStart = new Date(start)
      nextStart.setMonth(start.getMonth() + i)
      if (nextStart.getFullYear() > year) break
      const nextEnd = new Date(nextStart.getTime() + duration)
      events.push({
        ...base,
        start_date: nextStart.toISOString().slice(0, 10),
        end_date: nextEnd.toISOString().slice(0, 10),
        series_id: seriesId,
      })
    }
  } else if (base.recurrence === "yearly") {
    // For annual view, yearly means repeat next year — skip for single-year view
    // Could be extended to show multi-year events
  }

  return events
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
