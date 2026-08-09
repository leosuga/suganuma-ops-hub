import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"

const TABLES = ["task", "project", "account", "transaction", "health_log", "pregnancy", "appointment", "protocol", "protocol_entry", "note", "meal", "meal_plan", "habit_track", "habit_entry", "budget", "annual_event", "inbox_item"] as const

// FK columns that reference other user-owned tables.
// These are stripped on import to prevent dangling references when importing
// data from another user or DB. The data itself (text, amounts, dates) is preserved.
const FK_COLUMNS_TO_STRIP: Record<string, string[]> = {
  task: ["project_id", "linked_note_id"],
  note: ["project_id", "linked_task_id"],
  transaction: ["account_id"],
  meal_plan: ["meal_id"],
  habit_entry: ["habit_id"],
  protocol_entry: ["protocol_id"],
  appointment: ["pregnancy_id"],
  annual_event: ["series_id"],
}

// Import order: parent tables first so that if we later add FK remapping,
// the order is already correct. Currently we strip FKs, so order doesn't
// strictly matter, but this keeps the data consistent.
const IMPORT_ORDER = [
  "project",
  "account",
  "meal",
  "habit_track",
  "protocol",
  "pregnancy",
  "annual_event",
  "task",
  "transaction",
  "health_log",
  "appointment",
  "protocol_entry",
  "note",
  "meal_plan",
  "habit_entry",
  "budget",
  "inbox_item",
] as const

interface ExportData {
  version: string
  exported_at: string
  tables: Record<string, Record<string, unknown>[]>
}

export async function exportAllData(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const tables: ExportData["tables"] = {}

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("owner_id", user.id)
    if (error) throw error
    tables[table] = (data ?? []) as Record<string, unknown>[]
  }

  const exportData: ExportData = {
    version: "0.3.0",
    exported_at: new Date().toISOString(),
    tables,
  }

  return JSON.stringify(exportData, null, 2)
}

export async function importAllData(json: string): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  let data: ExportData
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error("JSON inválido")
  }

  if (!data.tables) throw new Error("Formato inválido: campo 'tables' ausente")

  let total = 0

  for (const table of IMPORT_ORDER) {
    if (!TABLES.includes(table)) continue
    const rows = data.tables[table]
    if (!Array.isArray(rows) || rows.length === 0) continue

    const fksToStrip = FK_COLUMNS_TO_STRIP[table] ?? []

    const cleaned = rows.map((row) => {
      // Strip auto-generated and timestamp columns
      const { id, created_at, updated_at, ...rest } = row as Record<string, unknown>
      // Strip cross-table FKs to prevent dangling references
      for (const fk of fksToStrip) {
        if (fk in rest) rest[fk] = null
      }
      // Overwrite owner_id with the current user
      return { ...rest, owner_id: user.id }
    })

    const { error } = await supabase.from(table).insert(cleaned)
    if (error) {
      logger.warn("import", `erro na tabela ${table}`, { error: error.message, rows: cleaned.length })
      continue
    }
    total += cleaned.length
  }

  return total
}