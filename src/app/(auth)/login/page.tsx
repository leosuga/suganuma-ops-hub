"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail]     = useState("")
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/callback` },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            SUGANUMA
          </h1>
          <p className="text-[10px] font-mono text-on-surface/30 tracking-widest mt-1">
            OPS HUB — COMMAND CENTER
          </p>
        </div>

        <div className="border border-border bg-surface rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-bg">
            <span className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              AUTENTICAÇÃO
            </span>
          </div>

          <div className="p-4">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                <p className="text-[12px] font-mono text-on-surface text-center">
                  Link enviado para
                </p>
                <p className="text-[11px] font-mono text-teal">{email}</p>
                <p className="text-[10px] font-mono text-on-surface/30 text-center">
                  Verifique sua caixa de entrada e clique no link para acessar.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoFocus
                    className="h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-[11px] font-mono text-danger">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="h-9 bg-teal/10 border border-teal text-teal font-mono text-[11px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                >
                  {loading ? "ENVIANDO..." : "ENVIAR MAGIC LINK →"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-[9px] font-mono text-on-surface/20 mt-4">
          ACESSO RESTRITO — SISTEMA PRIVADO
        </p>
      </div>
    </div>
  )
}
