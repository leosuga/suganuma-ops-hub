// Resolução de clientes OAuth.
//
// Dois modos são suportados:
//
// 1. CIMD (Client ID Metadata Document) — preferido. O `client_id` é uma URL HTTPS
//    que serve o próprio documento de registro do cliente. Não há banco de clientes
//    nem chamada de registro. É o que o Claude usa quando o servidor anuncia
//    `client_id_metadata_document_supported` + `token_endpoint_auth_methods_supported: ["none"]`.
//
// 2. DCR (Dynamic Client Registration, RFC 7591) — fallback para clientes que não
//    suportam CIMD. O cliente é persistido na tabela `oauth_client`.

import { createServiceClient } from "@/lib/supabase/service"
import { CIMD_FETCH_TIMEOUT_MS } from "./config"

export interface ResolvedClient {
  clientId: string
  /** Nome exibido na tela de consentimento. Para CIMD é sempre o host da URL. */
  displayName: string
  redirectUris: string[]
  source: "cimd" | "registered"
}

export class ClientResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string = "invalid_client"
  ) {
    super(message)
  }
}

function isLoopbackUri(uri: string): boolean {
  try {
    const u = new URL(uri)
    if (u.protocol !== "http:") return false
    const host = u.hostname.replace(/^\[|\]$/g, "")
    return host === "127.0.0.1" || host === "::1" || host === "localhost"
  } catch {
    return false
  }
}

/**
 * Compara redirect URIs. Endereços de loopback são comparados ignorando a porta,
 * porque clientes nativos (ex.: Claude Code) escolhem uma porta efêmera em runtime
 * — RFC 8252 §7.3.
 */
export function redirectUriMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true
  if (!isLoopbackUri(registered) || !isLoopbackUri(requested)) return false
  try {
    const a = new URL(registered)
    const b = new URL(requested)
    return a.hostname === b.hostname && a.pathname === b.pathname
  } catch {
    return false
  }
}

/**
 * Busca e valida um Client ID Metadata Document.
 *
 * O documento é auto-declarado, então a validação é deliberadamente conservadora:
 * precisa ser HTTPS, precisa ser auto-referencial (campo `client_id` igual à URL de
 * onde foi servido) e os redirect_uris precisam ser same-origin com o client_id —
 * exceto endereços de loopback, usados por clientes nativos.
 */
async function resolveCimdClient(clientId: string): Promise<ResolvedClient> {
  let url: URL
  try {
    url = new URL(clientId)
  } catch {
    throw new ClientResolutionError("client_id não é uma URL válida")
  }
  if (url.protocol !== "https:") {
    throw new ClientResolutionError("client_id precisa usar HTTPS")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CIMD_FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      redirect: "error",
    })
  } catch {
    throw new ClientResolutionError("Falha ao buscar o Client ID Metadata Document")
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new ClientResolutionError(`Client ID Metadata Document retornou ${res.status}`)
  }

  let doc: unknown
  try {
    doc = await res.json()
  } catch {
    throw new ClientResolutionError("Client ID Metadata Document não é JSON válido")
  }

  const meta = doc as { client_id?: unknown; redirect_uris?: unknown }

  // Auto-referencial: impede que um host sirva metadados de outro cliente.
  if (typeof meta.client_id !== "string" || meta.client_id !== clientId) {
    throw new ClientResolutionError("Client ID Metadata Document não é auto-referencial")
  }

  if (!Array.isArray(meta.redirect_uris) || meta.redirect_uris.length === 0) {
    throw new ClientResolutionError("Client ID Metadata Document sem redirect_uris")
  }

  const redirectUris: string[] = []
  for (const uri of meta.redirect_uris) {
    if (typeof uri !== "string") continue
    if (isLoopbackUri(uri)) {
      redirectUris.push(uri)
      continue
    }
    try {
      if (new URL(uri).origin === url.origin) redirectUris.push(uri)
    } catch {
      // ignora URIs malformadas
    }
  }

  if (redirectUris.length === 0) {
    throw new ClientResolutionError("Nenhum redirect_uri válido (same-origin ou loopback) no documento")
  }

  return {
    clientId,
    // Deliberadamente o host, não o client_name: o documento é auto-declarado,
    // então exibir um nome escolhido pelo cliente permitiria spoofing na tela de consentimento.
    displayName: url.host,
    redirectUris,
    source: "cimd",
  }
}

async function resolveRegisteredClient(clientId: string): Promise<ResolvedClient> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("oauth_client")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle()

  if (error) throw new ClientResolutionError("Falha ao consultar o cliente registrado")
  if (!data) throw new ClientResolutionError("Cliente desconhecido")

  const uris = Array.isArray(data.redirect_uris) ? (data.redirect_uris as string[]) : []
  return {
    clientId,
    displayName: typeof data.client_name === "string" && data.client_name ? data.client_name : clientId,
    redirectUris: uris,
    source: "registered",
  }
}

/** Resolve um client_id via CIMD (se for URL https) ou via registro dinâmico. */
export async function resolveClient(clientId: string): Promise<ResolvedClient> {
  if (clientId.startsWith("https://")) return resolveCimdClient(clientId)
  return resolveRegisteredClient(clientId)
}
