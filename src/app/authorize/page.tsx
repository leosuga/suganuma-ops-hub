import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  validateAuthorizeRequest,
  AuthorizeFatalError,
  AuthorizeRedirectError,
  buildRedirect,
} from "@/lib/oauth/request"
import { SCOPE_READ, SCOPE_WRITE, SCOPE_OFFLINE } from "@/lib/oauth/config"
import { ConsentActions } from "@/components/oauth/ConsentActions"

// Tela de consentimento OAuth. Server component: valida tudo no servidor e só
// então renderiza os botões (client component) que disparam a aprovação.

export const dynamic = "force-dynamic"

const SCOPE_LABELS: Record<string, string> = {
  [SCOPE_READ]: "Ler seus dados — tasks, finanças, saúde, notas, hábitos, refeições e projetos",
  [SCOPE_WRITE]: "Criar e alterar registros nos mesmos módulos",
  [SCOPE_OFFLINE]: "Manter o acesso ativo sem pedir login de novo a cada sessão",
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">SUGANUMA</h1>
          <p className="text-[10px] font-mono text-on-surface/50 tracking-widest mt-1">OPS HUB — AUTORIZAÇÃO</p>
        </div>
        <div className="border border-border bg-surface rounded-sm">{children}</div>
      </div>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Shell>
      <div className="px-4 py-3 border-b border-border bg-bg">
        <span className="text-[10px] font-mono font-semibold tracking-widest text-danger uppercase">
          SOLICITAÇÃO INVÁLIDA
        </span>
      </div>
      <div className="p-4">
        <p className="text-[12px] font-mono text-on-surface">{message}</p>
        <p className="text-[10px] font-mono text-on-surface/50 mt-3">
          Nada foi autorizado. Você pode fechar esta janela com segurança.
        </p>
      </div>
    </Shell>
  )
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") search.set(key, value)
    else if (Array.isArray(value) && value[0]) search.set(key, value[0])
  }

  let validated
  try {
    validated = await validateAuthorizeRequest(search)
  } catch (err) {
    if (err instanceof AuthorizeRedirectError) {
      const redirectUri = search.get("redirect_uri")
      if (redirectUri) {
        redirect(
          buildRedirect(redirectUri, {
            error: err.errorCode,
            error_description: err.message,
            state: search.get("state"),
          })
        )
      }
      return <ErrorPanel message={err.message} />
    }
    if (err instanceof AuthorizeFatalError) return <ErrorPanel message={err.message} />
    throw err
  }

  const { params, client } = validated

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/authorize?${search.toString()}`)}`)
  }

  const scopes = params.scope.split(" ").filter(Boolean)

  return (
    <Shell>
      <div className="px-4 py-3 border-b border-border bg-bg">
        <span className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
          AUTORIZAR ACESSO
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <p className="text-[13px] font-mono text-on-surface leading-relaxed">
            <span className="text-teal">{client.displayName}</span> está pedindo acesso à sua conta do Ops Hub.
          </p>
          <p className="text-[10px] font-mono text-on-surface/50 mt-2">
            Conectado como {user.email}
          </p>
        </div>

        <div className="border border-border rounded-sm">
          <div className="px-3 py-2 border-b border-border bg-bg">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
              PERMISSÕES SOLICITADAS
            </span>
          </div>
          <ul className="p-3 flex flex-col gap-2">
            {scopes.map((scope) => (
              <li key={scope} className="flex gap-2 text-[11px] font-mono text-on-surface/80">
                <span className="text-teal shrink-0">›</span>
                <span>{SCOPE_LABELS[scope] ?? scope}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] font-mono text-on-surface/50 leading-relaxed">
          Autorize apenas se você reconhece <span className="text-on-surface/80">{client.displayName}</span> como o
          destino pretendido. Você pode revogar o acesso a qualquer momento em Settings.
        </p>

        <ConsentActions search={search.toString()} />
      </div>
    </Shell>
  )
}
