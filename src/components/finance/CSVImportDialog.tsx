"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useImportCSV } from "@/lib/queries/finance"
import { cn } from "@/lib/utils"
import type { Transaction } from "@/lib/schemas/finance"

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId?: string
}

interface ParsedRow {
  occurred_on: string
  description: string
  amount: number
  kind: Transaction["kind"]
}

const NUBANK_HEADERS = ["date", "title", "amount"]
const GENERIC_HEADERS = ["data", "descricao", "valor"]

function detectKind(amount: number): Transaction["kind"] {
  return amount >= 0 ? "income" : "expense"
}

function parseCSVRows(text: string): ParsedRow[] {
  // dynamic import is not needed — papaparse is sync for string input
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Papa = require("papaparse") as typeof import("papaparse")
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.toLowerCase().trim().replace(/\s+/g, "_"),
  })

  return result.data.map((row) => {
    const dateRaw = row["date"] ?? row["data"] ?? row["occurred_on"] ?? ""
    const desc = row["title"] ?? row["descricao"] ?? row["description"] ?? row["memo"] ?? ""
    const amtRaw = row["amount"] ?? row["valor"] ?? row["value"] ?? "0"
    const amount = parseFloat(amtRaw.replace(",", ".").replace(/[^0-9.-]/g, ""))

    // Normalize date to YYYY-MM-DD
    let occurred_on = dateRaw
    if (dateRaw.includes("/")) {
      const parts = dateRaw.split("/")
      if (parts.length === 3) {
        // DD/MM/YYYY or MM/DD/YYYY — assume DD/MM/YYYY (Nubank BR)
        occurred_on = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
      }
    }

    return {
      occurred_on,
      description: desc,
      amount: Math.abs(amount),
      kind: detectKind(amount),
    }
  }).filter((r) => r.occurred_on && r.amount > 0)
}

export function CSVImportDialog({ open, onOpenChange, accountId }: CSVImportDialogProps) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [filename, setFilename] = useState("")
  const [step, setStep] = useState<"upload" | "preview">("upload")
  const fileRef = useRef<HTMLInputElement>(null)
  const importCSV = useImportCSV()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSVRows(text)
      setRows(parsed)
      setStep("preview")
    }
    reader.readAsText(file, "utf-8")
  }

  async function handleCommit() {
    const txns: Omit<Transaction, "id">[] = rows.map((r) => ({
      kind: r.kind,
      amount: r.amount,
      description: r.description,
      occurred_on: r.occurred_on,
      account_id: accountId ?? null,
      category: null,
      currency: "BRL",
    }))

    await importCSV.mutateAsync({ rows: txns, filename })
    setRows([])
    setStep("upload")
    onOpenChange(false)
  }

  function handleClose() {
    setRows([])
    setStep("upload")
    if (fileRef.current) fileRef.current.value = ""
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="bg-surface border-border max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            IMPORTAR CSV
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 flex flex-col gap-4">
          {step === "upload" && (
            <>
              <div
                className="border border-dashed border-border rounded-sm p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-teal/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <div className="w-8 h-8 rounded-sm border border-border flex items-center justify-center text-on-surface/40">
                  ↑
                </div>
                <p className="text-[11px] font-mono text-on-surface/40">
                  Clique para selecionar um arquivo CSV
                </p>
                <p className="text-[9px] font-mono text-on-surface/20">
                  Suporte: Nubank, formato genérico (data, descrição, valor)
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-on-surface/60">
                  {rows.length} transações encontradas em{" "}
                  <span className="text-teal">{filename}</span>
                </span>
                <button
                  onClick={() => { setStep("upload"); setRows([]) }}
                  className="text-[10px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors"
                >
                  trocar arquivo
                </button>
              </div>

              <div className="border border-border rounded-sm overflow-hidden max-h-80 overflow-y-auto">
                <div className="h-7 px-3 flex items-center gap-2 bg-bg border-b border-border">
                  {["TIPO", "DATA", "DESCRIÇÃO", "VALOR"].map((h) => (
                    <span key={h} className="text-[8px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase first:w-8 last:w-20 last:text-right">
                      {h}
                    </span>
                  ))}
                </div>
                {rows.slice(0, 100).map((r, i) => (
                  <div key={i} className="h-9 px-3 flex items-center gap-2 border-b border-border last:border-0 hover:bg-surface-hover">
                    <span className={cn(
                      "text-[8px] font-mono w-8 font-semibold",
                      r.kind === "income" ? "text-teal" : "text-danger"
                    )}>
                      {r.kind === "income" ? "REC" : "DES"}
                    </span>
                    <span className="text-[10px] font-mono text-on-surface/40 w-16">{r.occurred_on.slice(5).split("-").reverse().join("/")}</span>
                    <span className="text-[11px] font-mono text-on-surface flex-1 truncate">{r.description}</span>
                    <span className="text-[11px] font-mono text-on-surface/60 w-20 text-right tabular-nums">
                      {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                {rows.length > 100 && (
                  <div className="h-9 px-3 flex items-center">
                    <span className="text-[10px] font-mono text-on-surface/30">
                      +{rows.length - 100} linhas não exibidas
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleCommit}
                  disabled={importCSV.isPending || rows.length === 0}
                  className="h-8 px-4 border border-teal text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                >
                  {importCSV.isPending ? "IMPORTANDO..." : `IMPORTAR ${rows.length} TRANSAÇÕES →`}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
