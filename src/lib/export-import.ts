import { createClient } from "@/lib/supabase/client"

const TABLES = ["task", "account", "transaction", "health_log", "pregnancy", "appointment", "protocol", "protocol_entry", "note", "meal", "meal_plan"] as const

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
    version: "0.1.0",
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

  for (const [table, rows] of Object.entries(data.tables)) {
    if (!TABLES.includes(table as typeof TABLES[number])) continue
    if (!Array.isArray(rows) || rows.length === 0) continue

    const cleaned = rows.map((row) => {
      const { id, created_at, updated_at, ...rest } = row as Record<string, unknown>
      return { ...rest, owner_id: user.id }
    })

    const { error } = await supabase.from(table).insert(cleaned)
    if (error) {
      console.warn(`import: erro na tabela ${table}:`, error.message)
      continue
    }
    total += cleaned.length
  }

  return total
}
