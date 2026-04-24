"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          SETTINGS
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
          Configurações do sistema
        </p>
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

      {/* Version */}
      <p className="text-center text-[9px] font-mono text-on-surface/20">
        SUGANUMA OPS HUB — ACESSO RESTRITO
      </p>
    </div>
  )
}
