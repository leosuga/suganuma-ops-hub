"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateRecurringBill } from "@/lib/queries/bills"
import { useAccounts } from "@/lib/queries/finance"
import { cn } from "@/lib/utils"
import type { BillKind } from "@/lib/types/bill"

interface AddBillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KIND_OPTIONS: { value: BillKind; label: string }[] = [
  { value: "expense", label: "DESPESA" },
  { value: "income", label: "RECEITA" },
]

/**
 * Cadastro de despesa fixa (o que VENCE todo mês): descrição, valor, dia do
 * vencimento, categoria e conta.
 */
export function AddBillDialog({ open, onOpenChange }: AddBillDialogProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [day, setDay] = useState("10")
  const [category, setCategory] = useState("")
  const [accountId, setAccountId] = useState("")
  const [kind, setKind] = useState<BillKind>("expense")
  const { data: accounts = [] } = useAccounts()
  const createBill = useCreateRecurringBill()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount.replace(",", "."))
    if (!parsed || parsed <= 0) return
    const dayOfMonth = Math.min(31, Math.max(1, parseInt(day, 10) || 10))

    await createBill.mutateAsync({
      description: description.trim() || "Conta",
      amount: parsed,
      kind,
      category: category.trim() || null,
      account_id: accountId || null,
      day_of_month: dayOfMonth,
    })

    setDescription("")
    setAmount("")
    setCategory("")
    onOpenChange(false)
  }

  const inputClass =
    "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/60 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/50 transition-colors"

  const labelClass = "text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase"

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
            NOVA DESPESA FIXA
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>DESCRIÇÃO</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aluguel, internet, energia..."
              autoFocus
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className={labelClass}>VALOR</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>DIA DO VENCIMENTO</span>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className={labelClass}>TIPO</span>
              <div className="flex gap-1.5">
                {KIND_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setKind(o.value)}
                    className={cn(
                      "h-9 px-3 border font-mono text-[10px] font-semibold tracking-wider rounded-sm transition-colors",
                      kind === o.value
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-border text-on-surface/60 hover:text-on-surface"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>CATEGORIA</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="moradia"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>CONTA</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="">— sem conta —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={createBill.isPending}
              className="h-9 px-4 bg-teal/10 border border-teal text-teal font-mono text-[10px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
            >
              {createBill.isPending ? "..." : "SALVAR"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-3 text-on-surface/60 font-mono text-[10px] tracking-wider transition-colors"
            >
              CANCELAR
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
