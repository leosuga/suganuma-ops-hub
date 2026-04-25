"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface AgentToken {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tokens, setTokens] = useState<AgentToken[]>([])
  const [newTokenName, setNewTokenName] = useState("")
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadTokens = useCallback(async () => {
    const res = await fetch("/api/agent/tokens")
    if (res.ok) {
      const json = await res.json()
      setTokens(json.tokens ?? [])
    }
  }, [])

  useEffect(() => { loadTokens() }, [loadTokens])

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function handleCreateToken() {
    if (!newTokenName.trim()) return
    setCreating(true)
    const res = await fetch("/api/agent/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTokenName.trim() }),
    })
    if (res.ok) {
      const json = await res.json()
      setCreatedToken(json.token)
      setNewTokenName("")
      loadTokens()
    }
    setCreating(false)
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    await fetch(`/api/agent/tokens/${id}`, { method: "DELETE" })
    loadTokens()
    setRevoking(null)
  }

  async function handleCopy() {
    if (!createdToken) return
    await navigator.clipboard.writeText(createdToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const active = tokens.filter((t) => !t.revoked_at)
  const revoked = tokens.filter((t) => t.revoked_at)

  return (
    <div className="p-4 space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          SETTINGS
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
          Configurações do sistema
        </p>
      </div>

      {/* Agent tokens */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            AGENT TOKENS
          </span>
          <span className="text-[9px] font-mono text-on-surface/30">
            {active.length} ativo{active.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* New token form */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateToken() }}
            placeholder="Nome do token (ex: Claude Desktop)"
            className="flex-1 h-7 px-2 text-[11px] font-mono bg-bg border border-border rounded-sm text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal/60"
          />
          <button
            onClick={handleCreateToken}
            disabled={creating || !newTokenName.trim()}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal hover:bg-teal/10 rounded-sm disabled:opacity-30 transition-colors"
          >
            {creating ? "..." : "+ GERAR"}
          </button>
        </div>

        {/* Newly created token — shown once */}
        {createdToken && (
          <div className="px-4 py-3 border-b border-border bg-teal/5">
            <p className="text-[9px] font-mono text-teal mb-2 uppercase tracking-wider">
              Token gerado — copie agora, não será mostrado novamente
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] font-mono text-on-surface bg-bg border border-border rounded-sm px-2 py-1.5 truncate select-all">
                {createdToken}
              </code>
              <button
                onClick={handleCopy}
                className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/50 hover:border-teal hover:text-teal rounded-sm transition-colors"
              >
                {copied ? "✓ COPIADO" : "COPIAR"}
              </button>
              <button
                onClick={() => setCreatedToken(null)}
                className="h-7 w-7 flex items-center justify-center text-on-surface/30 hover:text-on-surface/60 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Token list */}
        {active.length === 0 && !createdToken ? (
          <div className="px-4 py-6 text-center">
            <span className="text-[11px] font-mono text-on-surface/20">Nenhum token ativo</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {active.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-on-surface truncate">{t.name}</p>
                  <p className="text-[9px] font-mono text-on-surface/30">
                    Criado {fmtDate(t.created_at)}
                    {t.last_used_at ? ` · Usado ${fmtDate(t.last_used_at)}` : " · Nunca usado"}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(t.id)}
                  disabled={revoking === t.id}
                  className={cn(
                    "h-6 px-2 text-[8px] font-mono font-semibold tracking-wider border rounded-sm transition-colors",
                    "border-danger/30 text-danger/50 hover:border-danger hover:text-danger disabled:opacity-30"
                  )}
                >
                  {revoking === t.id ? "..." : "REVOGAR"}
                </button>
              </div>
            ))}
          </div>
        )}

        {revoked.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border">
            <p className="text-[9px] font-mono text-on-surface/20">
              {revoked.length} token{revoked.length !== 1 ? "s" : ""} revogado{revoked.length !== 1 ? "s" : ""} não listado{revoked.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* System info */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            SISTEMA
          </span>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: "Stack", value: "Next.js 16 + Supabase" },
            { label: "Autenticação", value: "Magic Link (OTP)" },
            { label: "Armazenamento", value: "Supabase Postgres" },
            { label: "Deploy", value: "Oracle VPS + Coolify" },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-on-surface/40 uppercase tracking-wider">
                {label}
              </span>
              <span className="text-[11px] font-mono text-on-surface/60">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Session */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            SESSÃO
          </span>
        </div>
        <div className="p-4">
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full h-9 border border-danger/40 text-danger font-mono text-[10px] font-semibold tracking-widest rounded-sm hover:bg-danger/5 disabled:opacity-30 transition-colors"
          >
            {loading ? "SAINDO..." : "ENCERRAR SESSÃO →"}
          </button>
        </div>
      </div>

      <p className="text-center text-[9px] font-mono text-on-surface/20">
        SUGANUMA OPS HUB — ACESSO RESTRITO
      </p>
    </div>
  )
}
