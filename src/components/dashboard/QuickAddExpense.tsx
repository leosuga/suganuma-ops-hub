"use client"

import { useState } from "react"
import Link from "next/link"
import { useCreateTransaction } from "@/lib/queries/finance"

export function QuickAddExpense() {
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const createTxn = useCreateTransaction()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount.replace(",", "."))
    if (!value || !desc.trim()) return
    await createTxn.mutateAsync({
      kind: "expense",
      amount: value,
      currency: "BRL",
      description: desc.trim(),
      occurred_on: new Date().toISOString().slice(0, 10),
      category: null,
      account_id: null,
    })
    setAmount("")
    setDesc("")
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          DESPESA RÁPIDA
        </span>
        <Link href="/finance" className="ml-auto text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">
          +DETALHES →
        </Link>
      </div>
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="R$ 0,00"
          className="w-24 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors flex-none"
        />
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descrição da despesa..."
          className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
        <button
          type="submit"
          disabled={!amount || !desc.trim() || createTxn.isPending}
          className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none"
        >
          {createTxn.isPending ? "..." : "+ ADD"}
        </button>
      </div>
    </form>
  )
}
