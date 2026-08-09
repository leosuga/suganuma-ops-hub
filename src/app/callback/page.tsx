"use client"

import { Suspense } from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState("Verificando autenticação...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function handleAuth() {
      try {
        const hash = window.location.hash
        const hasAuthParams = hash.includes("access_token") || hash.includes("refresh_token")

        if (hasAuthParams) {
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          if (data.session) {
            setStatus("Autenticado! Redirecionando...")
            router.replace("/dashboard")
            return
          }
        }

        const code = searchParams.get("code")
        const token = searchParams.get("token")
        const type = searchParams.get("type")

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          setStatus("Autenticado! Redirecionando...")
          router.replace("/dashboard")
          return
        }

        if (token && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any,
          })
          if (error) throw error
          setStatus("Autenticado! Redirecionando...")
          router.replace("/dashboard")
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data.session) {
          router.replace("/dashboard")
          return
        }

        throw new Error("Nenhuma sessão encontrada. O link pode ter expirado ou já foi usado.")
      } catch (err: any) {
        console.error("[callback] error:", err)
        setError(err.message || "Erro na autenticação")
        setStatus("Falhou")
      }
    }

    handleAuth()
  }, [router, searchParams])

  return (
    <div className="min-h-[100dvh] bg-bg flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-2 h-2 rounded-full bg-teal animate-pulse mx-auto" />
        <p className="text-[12px] font-mono text-on-surface">{status}</p>
        {error && (
          <div className="space-y-2">
            <p className="text-[11px] font-mono text-danger">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="text-[10px] font-mono text-teal hover:text-teal-hi transition-colors"
            >
              ← VOLTAR PARA LOGIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-2 h-2 rounded-full bg-teal animate-pulse mx-auto" />
          <p className="text-[12px] font-mono text-on-surface">Verificando autenticação...</p>
        </div>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  )
}
