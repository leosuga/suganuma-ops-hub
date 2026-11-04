// Dedupe por URL da ponte Raindrop → Hub.
//
// A idempotência por `raindrop_id` (webhook_event) já existia e cobre replay do
// MESMO bookmark. Ela não cobre o caso real do Inbox: a mesma URL salva duas
// vezes no Raindrop (`_id` diferente) ou capturada por outro caminho (Share
// Target grava `source = 'manual'`). Aí o Hub ganha dois registros do mesmo
// link — e nenhum dos dois é bug do sync.
//
// Segunda camada: normaliza a URL e checa se o dono já tem registro dela, numa
// nota (`Fonte: <url>`) ou num item de Inbox. Ver docs/raindrop-hub-bridge.md.

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"

/** Parâmetros de rastreio que não distinguem conteúdo — sempre descartados. */
const TRACKING_PREFIXES = ["utm_"]
const TRACKING_KEYS = ["fbclid", "gclid", "msclkid", "igshid", "ref_src"]

function isTracking(key: string): boolean {
  const lower = key.toLowerCase()
  return TRACKING_PREFIXES.some((p) => lower.startsWith(p)) || TRACKING_KEYS.includes(lower)
}

/**
 * Normaliza uma URL para comparação.
 *
 * - host em minúsculas (domínio é case-insensitive)
 * - fragmento (`#...`) removido — não muda o documento
 * - `utm_*`, `fbclid`, `gclid`, `msclkid`, `igshid`, `ref_src` removidos e
 *   parâmetros restantes ordenados (mesmo conteúdo = mesma string)
 * - barra final removida
 * - **path NÃO é lowercased**: em vários sites o caminho é case-sensitive
 *
 * URL inválida volta só com `trim()` — dedupe falha, criação segue.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }

  const params = Array.from(parsed.searchParams.entries())
    .filter(([key]) => !isTracking(key))
    .sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1))
  const query = params.length
    ? `?${params.map(([k, v]) => `${k}=${v}`).join("&")}`
    : ""

  const path = parsed.pathname.replace(/\/+$/, "")

  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${query}`
}

/**
 * Chave de busca no banco: origem + path, sem query nem barra final. É a parte
 * que sobrevive às diferenças de tracking e existe como substring da URL crua
 * já gravada nas notas antigas — por isso o `ilike` encontra o histórico.
 * Case-insensitive (o `ilike` cobre o host; o path preserva a caixa).
 */
export function urlSearchKey(normalized: string): string {
  try {
    const parsed = new URL(normalized)
    return `${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}`
  } catch {
    return normalized
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/gi

/** URLs presentes num texto livre (corpo de nota ou de item de Inbox). */
export function extractUrls(text: string): string[] {
  return text.match(URL_IN_TEXT) ?? []
}

/** O texto contém a URL alvo? Comparação pela forma normalizada. */
export function textHasUrl(text: string, normalizedTarget: string): boolean {
  return extractUrls(text).some((candidate) => normalizeUrl(candidate) === normalizedTarget)
}

/** Escapa os curingas do `like`/`ilike` do Postgres. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export type DuplicateLocation = "note" | "inbox"

/**
 * Onde o dono já tem essa URL, se tiver. `null` = pode criar.
 *
 * **Nunca lança**: qualquer falha (query, rede, formato) é logada e tratada
 * como "não achei". Melhor duplicar um link do que perder um bookmark — o
 * sync não pode parar por causa do dedupe.
 */
export async function findExistingByUrl(ownerId: string, url: string): Promise<DuplicateLocation | null> {
  const target = normalizeUrl(url)
  const key = urlSearchKey(target)
  if (!key) return null

  try {
    const supabase = createServiceClient()
    const pattern = `%${escapeLike(key)}%`

    const { data: notes, error: notesError } = await supabase
      .from("note")
      .select("id, content")
      .eq("owner_id", ownerId)
      .ilike("content", pattern)
      .limit(5)
    if (notesError) throw notesError
    if ((notes ?? []).some((n) => textHasUrl(n.content ?? "", target))) return "note"

    const { data: inbox, error: inboxError } = await supabase
      .from("inbox_item")
      .select("id, content")
      .eq("owner_id", ownerId)
      .ilike("content", pattern)
      .limit(5)
    if (inboxError) throw inboxError
    if ((inbox ?? []).some((i) => textHasUrl(i.content ?? "", target))) return "inbox"

    return null
  } catch (err) {
    logger.warn("raindrop-sync", "Dedupe por URL falhou — seguindo com a criação", {
      url: target,
      error: errorMessage(err),
    })
    return null
  }
}

/**
 * Mensagem de um erro qualquer. O erro do PostgREST não é `Error`: é um objeto
 * `{ message, details, code }` — `String(err)` nele vira "[object Object]".
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === "string") return message
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
