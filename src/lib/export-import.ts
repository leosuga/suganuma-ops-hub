import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import { cleanRowsForImport, PRESERVE_ID_TABLES } from "@/lib/import-clean"

const TABLES = ["task", "project", "account", "transaction", "health_log", "pregnancy", "appointment", "protocol", "protocol_entry", "note", "meal", "meal_plan", "habit_track", "habit_entry", "budget", "annual_event", "inbox_item", "person", "person_relation", "person_conflict", "guest_event", "guest_invite"] as const

// FK columns that reference other user-owned tables.
// These are stripped on import to prevent dangling references when importing
// data from another user or DB. The data itself (text, amounts, dates) is preserved.
export const FK_COLUMNS_TO_STRIP: Record<string, string[]> = {
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
  "person",
  "guest_event",
  "person_relation",
  "person_conflict",
  "guest_invite",
] as const

export { IMPORT_ORDER }

interface ExportData {
  version: string
  exported_at: string
  tables: Record<string, Record<string, unknown>[]>
}

// Self-hosted Supabase caps rows per request (default 1000). Export must page
// through results or large tables (tasks, transactions) silently truncate.
const EXPORT_PAGE_SIZE = 1000
// PostgREST request body limits reject very large single inserts.
const INSERT_CHUNK_SIZE = 500

async function fetchAllRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  ownerId: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("owner_id", ownerId)
      .range(from, from + EXPORT_PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    all.push(...rows)
    if (rows.length < EXPORT_PAGE_SIZE) break
    from += EXPORT_PAGE_SIZE
  }
  return all
}

export async function exportAllData(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const tables: ExportData["tables"] = {}

  for (const table of TABLES) {
    tables[table] = await fetchAllRows(supabase, table, user.id)
  }

  const exportData: ExportData = {
    version: "0.4.0",
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

    const cleaned = cleanRowsForImport(table, rows as Record<string, unknown>[], user.id, fksToStrip)

    // Insert in chunks to stay under PostgREST body limits
    let inserted = 0
    for (let i = 0; i < cleaned.length; i += INSERT_CHUNK_SIZE) {
      const chunk = cleaned.slice(i, i + INSERT_CHUNK_SIZE)
      const { error } = PRESERVE_ID_TABLES.has(table)
        ? await supabase.from(table).upsert(chunk, { onConflict: "id" })
        : await supabase.from(table).insert(chunk)
      if (error) {
        logger.warn("import", `erro na tabela ${table} (chunk ${Math.floor(i / INSERT_CHUNK_SIZE)})`, {
          error: error.message,
          rows: chunk.length,
        })
        break
      }
      inserted += chunk.length
    }
    total += inserted
  }

  return total
}