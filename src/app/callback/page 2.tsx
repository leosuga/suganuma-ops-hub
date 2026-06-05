"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState("Verificando...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const token = searchParams.get("token")
    const type = searchParams.get("type")

    async function handleCallback() {
      try {
        // Supabase magic link uses hash fragments (#access_token=...)
        // Next.js doesn't parse hash, so we check both
        const hash = window.location.hash
        if (hash && hash.includes("access_token")) {
          // Let Supabase handle the hash
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          if (data.session) {
            setStatus("Autenticado! Redirecionando...")
            router.replace("/dashboard")
            return
          }
        }

        // Fallback: check for token in query params
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

        // Last resort: try getting session
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session) {
          setStatus("Autenticado! Redirecionando...")
          router.replace("/dashboard")
          return
        }

        throw new Error("Nenhuma sessão encontrada. Tente fazer login novamente.")
      } catch (err: any) {
        setError(err.message || "Erro na autenticação")
        setStatus("Falhou")
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
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
