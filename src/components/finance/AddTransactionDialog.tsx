"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateTransaction } from "@/lib/queries/finance"
import { cn } from "@/lib/utils"
import type { AccountRow } from "@/lib/queries/finance"
import type { TxnKind } from "@/lib/schemas/finance"

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: AccountRow[]
}

const KIND_OPTIONS: { value: TxnKind; label: string }[] = [
  { value: "income", label: "RECEITA" },
  { value: "expense", label: "DESPESA" },
  { value: "transfer", label: "TRANSFERÊNCIA" },
  { value: "tax", label: "IMPOSTO" },
]

const today = () => new Date().toISOString().slice(0, 10)

export function AddTransactionDialog({
  open,
  onOpenChange,
  accounts,
}: AddTransactionDialogProps) {
  const [kind, setKind] = useState<TxnKind>("expense")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [accountId, setAccountId] = useState<string>("")
  const [occurredOn, setOccurredOn] = useState(today())
  const createTxn = useCreateTransaction()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount.replace(",", "."))
    if (!parsed || parsed <= 0) return

    await createTxn.mutateAsync({
      kind,
      amount: parsed,
      description: description.trim() || null,
      category: category.trim() || null,
      account_id: accountId || null,
      occurred_on: occurredOn,
      currency: "BRL",
    })

    setAmount("")
    setDescription("")
    setCategory("")
    onOpenChange(false)
  }

  const inputClass =
    "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            NOVA TRANSAÇÃO
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Kind */}
          <div className="flex gap-2">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKind(opt.value)}
                className={cn(
                  "flex-1 h-7 text-[8px] font-mono font-semibold tracking-wider rounded-sm border transition-colors",
                  kind === opt.value
                    ? opt.value === "income"
                      ? "border-teal bg-teal/10 text-teal"
                      : opt.value === "expense"
                        ? "border-danger bg-danger/10 text-danger"
                        : opt.value === "transfer"
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-border bg-surface text-on-surface/50"
                    : "border-border text-on-surface/30 hover:border-on-surface/40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            required
            autoFocus
            className={inputClass}
          />

          {/* Description */}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className={inputClass}
          />

          {/* Category */}
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria (ex: alimentação, transporte)"
            className={inputClass}
          />

          {/* Account */}
          {accounts.length > 0 && (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="">Conta (opcional)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Date */}
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            required
            className={inputClass}
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 transition-colors"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={createTxn.isPending}
              className="h-8 px-4 border border-teal text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
            >
              {createTxn.isPending ? "SALVANDO..." : "SALVAR →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
