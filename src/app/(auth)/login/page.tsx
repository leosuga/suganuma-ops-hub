"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Login por_magic link_ (PKCE) + OTP de 6 dígitos (fallback).
 *
 * PKCE funciona quando o link abre no MESMO browser que pediu o login.
 * No iOS o link do e-mail frequentemente abre em outro contexto (app de
 * e-mail → browser), perdendo o code_verifier → "PKCE code verifier not
 * found". O OTP de 6 dígitos digitado manualmente funciona cross-device
 * e resolve o mobile de vez.
 */
type Step = "email" | "otp"

export default function LoginPage() {
  const [email, setEmail]     = useState("")
  const [code, setCode]       = useState("")
  const [step, setStep]       = useState<Step>("email")
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    // Preserva o destino (ex.: um fluxo OAuth iniciado em /authorize) através do magic link.
    const next = new URLSearchParams(window.location.search).get("next")
    const callback = new URL("/api/auth/callback", window.location.origin)
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      callback.searchParams.set("next", next)
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString() },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
    setStep("otp")
  }

  async function handleSubmitOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const next = new URLSearchParams(window.location.search).get("next")
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\s/g, ""),
      type: "email",
    })
    setLoading(false)
    if (error) {
      setError("Código inválido ou expirado — solicite um novo.")
      setCode("")
      return
    }
    // sessão no device atual: redireciona client-side (cookies já setados)
    window.location.assign(target)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            SUGANUMA
          </h1>
          <p className="text-[10px] font-mono text-on-surface/40 tracking-widest mt-1">
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
            {step === "otp" ? (
              <form onSubmit={handleSubmitOtp} className="flex flex-col gap-3">
                <p className="text-[11px] font-mono text-on-surface/60 leading-relaxed">
                  Se o link não abrir no mesmo navegador, use o código de 6 dígitos do e-mail:
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                    Código do e-mail
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="••••••"
                    autoFocus
                    className="h-11 bg-bg border border-border rounded-sm px-3 text-[20px] font-mono tracking-[0.4em] text-center text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-teal transition-colors"
                  />
                </div>
                {error && <p className="text-[11px] font-mono text-danger">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || code.trim().length < 6}
                  className="h-9 bg-teal/10 border border-teal text-teal font-mono text-[11px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                >
                  {loading ? "VERIFICANDO..." : "ENTRAR →"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setSent(false); setCode(""); }}
                  className="text-[9px] font-mono text-on-surface/40 hover:text-teal tracking-wider transition-colors"
                >
                  ← usar outro e-mail
                </button>
              </form>
            ) : sent ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                <p className="text-[12px] font-mono text-on-surface text-center">
                  Link enviado para
                </p>
                <p className="text-[11px] font-mono text-teal">{email}</p>
                <p className="text-[10px] font-mono text-on-surface/40 text-center">
                  Toque no link OU digite o código de 6 dígitos abaixo.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("otp")}
                  className="h-9 px-4 bg-teal/10 border border-teal text-teal font-mono text-[11px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 transition-colors"
                >
                  DIGIGITAR CÓDIGO →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitEmail} className="flex flex-col gap-3">
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
                    className="h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-teal transition-colors"
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

        <p className="text-center text-[9px] font-mono text-on-surface/40 mt-4">
          ACESSO RESTRITO — SISTEMA PRIVADO
        </p>
      </div>
    </div>
  )
}