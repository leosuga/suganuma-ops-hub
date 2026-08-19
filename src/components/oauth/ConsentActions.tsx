"use client"

import { useState } from "react"

// Botões da tela de consentimento.
//
// A submissão é feita por fetch + window.location.replace em vez de um <form>
// tradicional: a CSP do app define form-action 'self', e navegadores aplicam essa
// diretiva também ao redirect que segue um POST de formulário — o que bloquearia
// o retorno ao cliente OAuth (claude.ai ou loopback). Uma navegação iniciada por
// script não passa por form-action.

export function ConsentActions({ search }: { search: string }) {
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(decision: "approve" | "deny") {
    setBusy(decision)
    setError(null)
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search, decision }),
      })
      const data = (await res.json()) as { redirect?: string; error?: string }
      if (!res.ok || !data.redirect) {
        setError(data.error ?? "Falha ao processar a autorização")
        setBusy(null)
        return
      }
      window.location.replace(data.redirect)
    } catch {
      setError("Falha de rede ao processar a autorização")
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-[11px] font-mono text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit("deny")}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] border border-border rounded-sm text-[11px] font-mono tracking-widest uppercase text-on-surface/70 hover:text-on-surface hover:border-on-surface/40 transition-colors disabled:opacity-40"
        >
          {busy === "deny" ? "..." : "Negar"}
        </button>
        <button
          type="button"
          onClick={() => submit("approve")}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] border border-teal bg-teal/10 rounded-sm text-[11px] font-mono tracking-widest uppercase text-teal hover:bg-teal/20 transition-colors disabled:opacity-40"
        >
          {busy === "approve" ? "..." : "Autorizar"}
        </button>
      </div>
    </div>
  )
}
