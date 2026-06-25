"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { useTitle } from "@/lib/useTitle"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { cn } from "@/lib/utils"
import { getAccent, setAccent, type Accent } from "@/lib/theme"
import { exportAllData, importAllData } from "@/lib/export-import"

const SelectiveImportDialog = dynamic(() => import("@/components/settings/SelectiveImportDialog").then(m => ({ default: m.SelectiveImportDialog })), {
  loading: () => <div className="fixed inset-0 z-50 bg-black/50 animate-pulse" />,
})

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

const ACCENTS: { value: Accent; label: string; color: string }[] = [
  { value: "teal", label: "TEAL", color: "bg-[#55D7ED]" },
  { value: "blue", label: "BLUE", color: "bg-[#60A5FA]" },
  { value: "green", label: "GREEN", color: "bg-[#4ADE80]" },
  { value: "purple", label: "PURPLE", color: "bg-[#C084FC]" },
  { value: "orange", label: "ORANGE", color: "bg-[#FB923C]" },
]

export default function SettingsPage() {
  useTitle("Settings · Suganuma Ops Hub")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tokens, setTokens] = useState<AgentToken[]>([])
  const [tokenUi, setTokenUi] = useState<{
    newTokenName: string
    createdToken: string | null
    creating: boolean
    revoking: string | null
    copied: boolean
  }>({
    newTokenName: "",
    createdToken: null,
    creating: false,
    revoking: null,
    copied: false,
  })
  const [accent, setAccentState] = useState<Accent>("teal")
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectImportOpen, setSelectImportOpen] = useState(false)

  const loadTokens = useCallback(async () => {
    const res = await fetch("/api/agent/tokens")
    if (res.ok) {
      const json = await res.json()
      setTokens(json.tokens ?? [])
    }
  }, [])

  useEffect(() => { loadTokens(); setAccentState(getAccent()) }, [loadTokens])

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function handleCreateToken() {
    if (!tokenUi.newTokenName.trim()) return
    setTokenUi((s) => ({ ...s, creating: true }))
    const res = await fetch("/api/agent/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tokenUi.newTokenName.trim() }),
    })
    if (res.ok) {
      const json = await res.json()
      setTokenUi((s) => ({ ...s, createdToken: json.token, newTokenName: "", creating: false }))
      loadTokens()
    } else {
      setTokenUi((s) => ({ ...s, creating: false }))
    }
  }

  async function handleRevoke(id: string) {
    setTokenUi((s) => ({ ...s, revoking: id }))
    await fetch(`/api/agent/tokens/${id}`, { method: "DELETE" })
    loadTokens()
    setTokenUi((s) => ({ ...s, revoking: null }))
  }

  async function handleCopy() {
    if (!tokenUi.createdToken) return
    await navigator.clipboard.writeText(tokenUi.createdToken)
    setTokenUi((s) => ({ ...s, copied: true }))
    setTimeout(() => setTokenUi((s) => ({ ...s, copied: false })), 2000)
  }

  function handleAccentChange(a: Accent) {
    setAccentState(a)
    setAccent(a)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const json = await exportAllData()
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ops-hub-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent fail
    }
    setExporting(false)
  }

  async function handleImport() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setImporting(true)
      try {
        const text = await file.text()
        const count = await importAllData(text)
        alert(`${count} registros importados com sucesso`)
      } catch {
        alert("Erro ao importar. Verifique o arquivo.")
      }
      setImporting(false)
    }
    input.click()
  }

  const active = tokens.filter((t) => !t.revoked_at)
  const revoked = tokens.filter((t) => t.revoked_at)

  return (
    <SectionErrorBoundary label="SETTINGS">
    <div className="p-4 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          SETTINGS
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
          Configurações do sistema
        </p>
      </div>

      {/* Theme */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">TEMA</span>
        </div>
        <div className="p-4 flex items-center gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => handleAccentChange(a.value)}
              className={cn(
                "flex items-center gap-2 h-7 px-3 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                accent === a.value
                  ? "border-teal bg-teal/10 text-teal"
                  : "border-border text-on-surface/30 hover:border-on-surface/40"
              )}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full", a.color)} />
              {a.label}
            </button>
          ))}
        </div>
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
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <input
            type="text"
            value={tokenUi.newTokenName}
            onChange={(e) => setTokenUi((s) => ({ ...s, newTokenName: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateToken() }}
            placeholder="Nome do token (ex: Claude Desktop)"
            className="flex-1 h-7 px-2 text-[11px] font-mono bg-bg border border-border rounded-sm text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal/60"
          />
          <button
            onClick={handleCreateToken}
            disabled={tokenUi.creating || !tokenUi.newTokenName.trim()}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal hover:bg-teal/10 rounded-sm disabled:opacity-30 transition-colors"
          >
            {tokenUi.creating ? "..." : "+ GERAR"}
          </button>
        </div>
        {tokenUi.createdToken && (
          <div className="px-4 py-3 border-b border-border bg-teal/5">
            <p className="text-[9px] font-mono text-teal mb-2 uppercase tracking-wider">
              Token gerado — copie agora, não será mostrado novamente
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] font-mono text-on-surface bg-bg border border-border rounded-sm px-2 py-1.5 truncate select-all">
                {tokenUi.createdToken}
              </code>
              <button onClick={handleCopy} className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/50 hover:border-teal hover:text-teal rounded-sm transition-colors">
                {tokenUi.copied ? "✓ COPIADO" : "COPIAR"}
              </button>
              <button onClick={() => setTokenUi((s) => ({ ...s, createdToken: null }))} className="h-7 w-7 flex items-center justify-center text-on-surface/30 hover:text-on-surface/60 transition-colors">×</button>
            </div>
          </div>
        )}
        {active.length === 0 && !tokenUi.createdToken ? (
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
                <button onClick={() => handleRevoke(t.id)} disabled={tokenUi.revoking === t.id} className={cn("h-6 px-2 text-[8px] font-mono font-semibold tracking-wider border rounded-sm transition-colors", "border-danger/30 text-danger/50 hover:border-danger hover:text-danger disabled:opacity-30")}>
                  {tokenUi.revoking === t.id ? "..." : "REVOGAR"}
                </button>
              </div>
            ))}
          </div>
        )}
        {revoked.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border">
            <p className="text-[9px] font-mono text-on-surface/20">
              {revoked.length} token{revoked.length !== 1 ? "s" : ""} revogado{revoked.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Data export/import */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">DADOS</span>
        </div>
        <div className="p-4 flex items-center gap-3">
          <button onClick={handleExport} disabled={exporting} className="h-8 px-4 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal rounded-sm hover:bg-teal/10 disabled:opacity-30 transition-colors">
            {exporting ? "EXPORTANDO..." : "EXPORTAR BACKUP ↓"}
          </button>
          <button onClick={() => setSelectImportOpen(true)} className="h-8 px-4 text-[9px] font-mono font-semibold tracking-wider border border-teal/40 text-teal rounded-sm hover:bg-teal/10 transition-colors">
            IMPORTAR SELETIVO ↑
          </button>
          <button onClick={handleImport} disabled={importing} className="h-8 px-4 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/40 rounded-sm hover:border-on-surface/40 hover:text-on-surface/70 disabled:opacity-30 transition-colors">
            {importing ? "IMPORTANDO..." : "IMPORTAR TUDO ↑"}
          </button>
        </div>
      </div>

      {/* System info */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">SISTEMA</span>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: "Stack", value: "Next.js 16 + Supabase" },
            { label: "Autenticação", value: "Magic Link (OTP)" },
            { label: "Armazenamento", value: "Supabase Postgres" },
            { label: "Deploy", value: "Oracle VPS + Coolify" },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-on-surface/40 uppercase tracking-wider">{label}</span>
              <span className="text-[11px] font-mono text-on-surface/60">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Session */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">SESSÃO</span>
        </div>
        <div className="p-4">
          <button onClick={handleLogout} disabled={loading} className="w-full h-9 border border-danger/40 text-danger font-mono text-[10px] font-semibold tracking-widest rounded-sm hover:bg-danger/5 disabled:opacity-30 transition-colors">
            {loading ? "SAINDO..." : "ENCERRAR SESSÃO →"}
          </button>
        </div>
      </div>

      <p className="text-center text-[9px] font-mono text-on-surface/20">
        SUGANUMA OPS HUB — ACESSO RESTRITO
      </p>

      <SelectiveImportDialog open={selectImportOpen} onOpenChange={setSelectImportOpen} />
    </div>
    </SectionErrorBoundary>
  )
}
