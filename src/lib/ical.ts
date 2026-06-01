import type { AnnualEventInsert } from "@/lib/types"

// Export events to iCal format (.ics)
export function exportToICal(events: { title: string; start_date: string; end_date: string; color: string }[]): string {
  const lines: string[] = []
  lines.push("BEGIN:VCALENDAR")
  lines.push("VERSION:2.0")
  lines.push("PRODID:-//Suganuma Ops Hub//PT")
  lines.push("CALSCALE:GREGORIAN")
  lines.push("METHOD:PUBLISH")
  lines.push("X-WR-CALNAME:Suganuma Ops Hub")
  lines.push("X-WR-TIMEZONE:America/Sao_Paulo")

  for (const event of events) {
    const uid = `${crypto.randomUUID()}@ops.suganuma.com.br`
    const dtstart = event.start_date.replace(/-/g, "")
    // iCal DTEND is exclusive (the day AFTER the last day)
    const endDate = new Date(event.end_date + "T00:00:00")
    endDate.setDate(endDate.getDate() + 1)
    const dtend = endDate.toISOString().slice(0, 10).replace(/-/g, "")

    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${uid}`)
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${dtend}`)
    lines.push(`SUMMARY:${escapeICalText(event.title)}`)
    lines.push(`DTSTAMP:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}T000000Z`)
    if (event.color) {
      lines.push(`COLOR:${event.color}`)
    }
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

// Parse iCal file and return events
export function importFromICal(icsContent: string): AnnualEventInsert[] {
  const events: AnnualEventInsert[] = []
  const lines = icsContent.split(/\r?\n/)

  let currentEvent: Partial<AnnualEventInsert> | null = null
  let inEvent = false

  for (let line of lines) {
    // Handle line folding (lines starting with space are continuations)
    if (line.startsWith(" ")) {
      line = line.slice(1)
    }

    const upper = line.toUpperCase()

    if (upper === "BEGIN:VEVENT") {
      inEvent = true
      currentEvent = {}
    } else if (upper === "END:VEVENT") {
      if (currentEvent?.title && currentEvent?.start_date && currentEvent?.end_date) {
        events.push({
          title: currentEvent.title,
          start_date: currentEvent.start_date,
          end_date: currentEvent.end_date,
          color: currentEvent.color || "#3B82F6",
          recurrence: "none",
        })
      }
      inEvent = false
      currentEvent = null
    } else if (inEvent && currentEvent) {
      if (upper.startsWith("SUMMARY")) {
        currentEvent.title = unescapeICalText(parseICalValue(line))
      } else if (upper.startsWith("DTSTART")) {
        const val = parseICalValue(line)
        currentEvent.start_date = parseICalDate(val)
      } else if (upper.startsWith("DTEND")) {
        const val = parseICalValue(line)
        // DTEND in iCal is exclusive, so subtract one day
        const d = parseICalDate(val)
        if (d) {
          const date = new Date(d + "T00:00:00")
          date.setDate(date.getDate() - 1)
          currentEvent.end_date = date.toISOString().slice(0, 10)
        }
      } else if (upper.startsWith("COLOR")) {
        currentEvent.color = parseICalValue(line)
      }
    }
  }

  return events
}

function parseICalValue(line: string): string {
  const colonIndex = line.indexOf(":")
  if (colonIndex === -1) return line
  return line.slice(colonIndex + 1)
}

function parseICalDate(val: string): string | null {
  // Handle formats: 20260915 or 20260915T120000Z
  const clean = val.replace(/T.*$/, "").replace(/-/g, "")
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return null
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\;/g, ";")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\")
}
