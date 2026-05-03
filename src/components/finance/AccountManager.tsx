"use client"

import { useState } from "react"
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from "@/lib/queries/finance"
import { cn } from "@/lib/utils"

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AccountManager() {
  const { data: accounts = [], isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [kind, setKind] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const inputClass = "h-7 bg-bg border border-border rounded-sm px-2 text-[11px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"

  function startAdd() {
    setName("")
    setKind("")
    setAdding(true)
    setEditingId(null)
  }

  function startEdit(account: typeof accounts[0]) {
    setName(account.name)
    setKind(account.kind ?? "")
    setEditingId(account.id)
    setAdding(false)
  }

  function cancelForm() {
    setName("")
    setKind("")
    setAdding(false)
    setEditingId(null)
  }

  async function handleSave() {
    if (!name.trim()) return

    if (editingId) {
      await updateAccount.mutateAsync({
        id: editingId,
        name: name.trim(),
        kind: kind.trim() || null,
      })
    } else {
      await createAccount.mutateAsync({
        name: name.trim(),
        kind: kind.trim() || null,
        currency: "BRL",
        opening_balance: 0,
      })
    }

    cancelForm()
  }

  async function handleDelete(id: string) {
    await deleteAccount.mutateAsync(id)
    setConfirmDelete(null)
    if (editingId === id) cancelForm()
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          CONTAS
        </span>
        {!adding && !editingId && (
          <button
            onClick={startAdd}
            className="text-[9px] font-mono text-teal hover:text-teal-hi transition-colors tracking-wider"
          >
            + NOVA CONTA
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse" />
      ) : accounts.length === 0 && !adding ? (
        <div className="p-6 flex items-center justify-center">
          <button
            onClick={startAdd}
            className="text-[11px] font-mono text-on-surface/20 hover:text-teal transition-colors"
          >
            Nenhuma conta — clique para criar
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {accounts.map((acct) => {
            if (editingId === acct.id) {
              return (
                <div key={acct.id} className="flex items-center gap-2 h-10 px-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                    placeholder="Nome da conta"
                    autoFocus
                    className={cn(inputClass, "flex-1")}
                  />
                  <input
                    type="text"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                    placeholder="Tipo (ex: corrente)"
                    className={cn(inputClass, "w-32")}
                  />
                  <button
                    onClick={handleSave}
                    disabled={updateAccount.isPending || !name.trim()}
                    className="h-7 px-2 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal rounded-sm hover:bg-teal/10 disabled:opacity-30 transition-colors"
                  >
                    {updateAccount.isPending ? "..." : "OK"}
                  </button>
                  <button onClick={cancelForm} className="text-on-surface/30 hover:text-on-surface/60 text-[14px]">×</button>
                </div>
              )
            }

            return (
              <div key={acct.id} className="flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors">
                <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{acct.name}</span>
                {acct.kind && (
                  <span className="text-[10px] font-mono text-on-surface/40 truncate max-w-[120px]">{acct.kind}</span>
                )}
                <span className="text-[10px] font-mono text-on-surface/30">
                  {acct.currency}
                </span>
                <span className="text-[10px] font-mono text-teal tabular-nums w-20 text-right">
                  {fmt(Number(acct.opening_balance))}
                </span>

                {confirmDelete === acct.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(acct.id)}
                      className="h-6 px-2 text-[8px] font-mono font-semibold tracking-wider border border-danger text-danger rounded-sm hover:bg-danger/10 transition-colors"
                    >
                      DEL
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-on-surface/30 hover:text-on-surface/60 text-[14px]"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(acct)}
                      className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-teal transition-colors text-[11px]"
                      aria-label={`Editar conta: ${acct.name}`}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setConfirmDelete(acct.id)}
                      className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-danger transition-colors"
                      aria-label={`Excluir conta: ${acct.name}`}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {adding && (
            <div className="flex items-center gap-2 h-10 px-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                placeholder="Nome da conta"
                autoFocus
                className={cn(inputClass, "flex-1")}
              />
              <input
                type="text"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                placeholder="Tipo (ex: corrente)"
                className={cn(inputClass, "w-32")}
              />
              <button
                onClick={handleSave}
                disabled={createAccount.isPending || !name.trim()}
                className="h-7 px-2 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal rounded-sm hover:bg-teal/10 disabled:opacity-30 transition-colors"
              >
                {createAccount.isPending ? "..." : "OK"}
              </button>
              <button onClick={cancelForm} className="text-on-surface/30 hover:text-on-surface/60 text-[14px]">×</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
