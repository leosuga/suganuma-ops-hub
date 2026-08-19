"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const TABLE_LABELS: Record<string, string> = {
  task: "Tasks",
  project: "Projetos",
  account: "Contas",
  transaction: "Transações",
  health_log: "Health Logs",
  pregnancy: "Gestação",
  appointment: "Consultas",
  protocol: "Protocolos",
  protocol_entry: "Entradas Protocolo",
  note: "Notas",
  meal: "Refeições",
  meal_plan: "Plano Alimentar",
  habit_track: "Hábitos",
  habit_entry: "Entradas Hábito",
  budget: "Orçamento",
}

interface TableInfo {
  name: string
  label: string
  rows: number
}

interface SelectiveImportDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function SelectiveImportDialog({ open, onOpenChange }: SelectiveImportDialogProps) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fileLoaded, setFileLoaded] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [fileName, setFileName] = useState("")

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string)
        if (!json.tables || typeof json.tables !== "object") {
          alert("Arquivo inválido: campo 'tables' ausente")
          return
        }
        const info: TableInfo[] = []
        for (const [name, rows] of Object.entries(json.tables)) {
          if (Array.isArray(rows) && rows.length > 0 && TABLE_LABELS[name]) {
            info.push({ name, label: TABLE_LABELS[name], rows: rows.length })
          }
        }
        info.sort((a, b) => b.rows - a.rows)
        setTables(info)
        setSelected(new Set(info.map((t) => t.name)))
        setFileLoaded(true)
      } catch {
        alert("Erro ao parsear JSON")
      }
    }
    reader.readAsText(file)
  }

  function toggleTable(name: string) {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === tables.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tables.map((t) => t.name)))
    }
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    setImported(0)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    let total = 0

    // Re-read file from input
    const inputEl = document.getElementById("import-file-input") as HTMLInputElement
    const file = inputEl?.files?.[0]
    if (!file) { setImporting(false); return }

    const text = await file.text()
    const json = JSON.parse(text)

    for (const table of tables) {
      if (!selected.has(table.name)) continue
      const rows = json.tables[table.name]
      if (!Array.isArray(rows) || rows.length === 0) continue

      const cleaned = rows.map((row: Record<string, unknown>) => {
        const { id, created_at, updated_at, ...rest } = row
        return { ...rest, owner_id: user.id }
      })

      const { error } = await supabase.from(table.name).insert(cleaned)
      if (error) {
        throw new Error(`import: erro na tabela ${table.name}: ${error.message}`)
      }
      total += cleaned.length
    }

    setImported(total)
    setImporting(false)
  }

  function handleClose() {
    setTables([])
    setSelected(new Set())
    setFileLoaded(false)
    setImported(0)
    setFileName("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            IMPORTAR — SELETIVO
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {!fileLoaded ? (
            <div>
              <input
                id="import-file-input"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="block w-full text-[11px] font-mono text-on-surface/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border file:border-border file:bg-bg file:text-[10px] file:font-mono file:text-teal file:cursor-pointer"
              />
              <p className="text-[9px] font-mono text-on-surface/40 mt-2">
                Selecione um arquivo .json de backup do Ops Hub
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-on-surface/50 truncate flex-1">
                  {fileName}
                </span>
                <button
                  onClick={toggleAll}
                  className="text-[9px] font-mono text-on-surface/40 hover:text-teal transition-colors"
                >
                  {selected.size === tables.length ? "DESMARCAR" : "MARCAR"} TUDO
                </button>
              </div>

              <div className="space-y-1 max-h-64 overflow-auto">
                {tables.map((t) => (
                  <label
                    key={t.name}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-sm border cursor-pointer transition-colors",
                      selected.has(t.name)
                        ? "border-teal/30 bg-teal/5"
                        : "border-border hover:border-on-surface/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(t.name)}
                      onChange={() => toggleTable(t.name)}
                      className="w-3 h-3 rounded-[2px] border border-on-surface/30 bg-bg checked:bg-teal checked:border-teal cursor-pointer"
                    />
                    <span className="flex-1 text-[11px] font-mono text-on-surface/70">
                      {t.label}
                    </span>
                    <span className="text-[9px] font-mono text-on-surface/40">
                      {t.rows} linha{t.rows !== 1 ? "s" : ""}
                    </span>
                  </label>
                ))}
              </div>

              {imported > 0 && (
                <div className="text-center py-2 border border-teal/30 bg-teal/5 rounded-sm">
                  <span className="text-[11px] font-mono text-teal">
                    {imported} registros importados
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  className="h-8 px-3 font-mono text-[10px] tracking-wider text-on-surface/40 hover:text-on-surface/60 transition-colors"
                >
                  FECHAR
                </button>
                <button
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing}
                  className="h-8 px-4 bg-teal/10 border border-teal text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                >
                  {importing ? "IMPORTANDO..." : imported > 0 ? "IMPORTAR MAIS" : "IMPORTAR"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
