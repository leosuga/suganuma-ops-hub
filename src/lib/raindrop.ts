// Raindrop.io API client — ingestão de bookmarks das collections de conhecimento técnico.
//
// Fonte: https://developer.raindrop.io/
//   - Auth: Test Token (não expira) via `Authorization: Bearer <token>`.
//   - Listar: GET /rest/v1/raindrops/{collectionId}?sort=-created&page=0&perpage=50
//   - `collectionId=0` retorna TODAS as collections (exceto Trash); filtramos
//     client-side por `collection.$id` para pegar só as collections-alvo.
//   - Filtro nativo de data via `search=created:>YYYY-MM-DD` (operadores de busca).
//   - `perpage` máximo é 50; `page` é 0-based.

const BASE_URL = "https://api.raindrop.io/rest/v1"

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

const RAINDROP_TOKEN = process.env.RAINDROP_TOKEN || ""
// Lista de IDs separados por vírgula (ex: "123,456"). `0` = todas (não usar).
const RAINDROP_COLLECTION_IDS = process.env.RAINDROP_COLLECTION_IDS || ""
const RAINDROP_TIMEOUT_MS = Number(process.env.RAINDROP_TIMEOUT_MS) || 30_000

// Tipos de raindrop que não têm texto extraível para resumo (pulados na ingestão).
const SKIP_TYPES = new Set(["image", "audio"])

export interface RaindropItem {
  _id: number
  title: string
  excerpt: string
  link: string
  tags: string[]
  created: string
  lastUpdate: string
  type: string
  collection?: { $id: number }
  note?: string
  highlights?: Array<{ _id: string; text: string; note?: string; created: string }>
}

export interface RaindropCollection {
  _id: number
  title: string
  count: number
}

interface RaindropListResponse {
  result: boolean
  items: RaindropItem[]
  count: number
  collectionId: number
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${RAINDROP_TOKEN}`,
    "Content-Type": "application/json",
  }
}

/**
 * Lista todas as collections do usuário. Uso único/administrativo: descobrir os
 * IDs das collections de conhecimento técnico e fixá-los em RAINDROP_COLLECTION_IDS.
 */
export async function listCollections(): Promise<RaindropCollection[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/collections`, { headers: authHeaders() }, RAINDROP_TIMEOUT_MS)
  if (!res.ok) {
    throw new Error(`Raindrop collections failed: ${res.status} ${await res.text().catch(() => "")}`)
  }
  const data = (await res.json()) as { result: boolean; items: RaindropCollection[] }
  return data.items ?? []
}

/** Lista collections aninhadas (child collections). */
export async function listChildCollections(): Promise<RaindropCollection[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/collections/childrens`, { headers: authHeaders() }, RAINDROP_TIMEOUT_MS)
  if (!res.ok) {
    throw new Error(`Raindrop child collections failed: ${res.status} ${await res.text().catch(() => "")}`)
  }
  const data = (await res.json()) as { result: boolean; items: RaindropCollection[] }
  return data.items ?? []
}

/**
 * Mapa `collectionId → título`, cobrindo collections raiz e aninhadas. Usado para
 * adicionar o nome da collection como tag automática nas notas/inbox.
 */
export async function getCollectionTitleMap(): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  const [root, children] = await Promise.all([
    listCollections().catch(() => [] as RaindropCollection[]),
    listChildCollections().catch(() => [] as RaindropCollection[]),
  ])
  for (const c of [...root, ...children]) {
    map.set(c._id, c.title)
  }
  return map
}

/** Normaliza o título de uma collection para uma tag (minúsculas, hífens, sem acento). */
export function collectionSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Lista raindrops de uma collection, opcionalmente filtrando por data de criação
 * (filtro nativo `created:>YYYY-MM-DD`) e paginando.
 *
 * `sinceDate` deve ser "YYYY-MM-DD". O filtro é por granularidade de dia, então
 * o chamador deve combinar com dedup (webhook_event) para a borda do dia.
 */
export async function listRaindrops(
  collectionId: string,
  opts: { sinceDate?: string; page?: number; perpage?: number } = {}
): Promise<RaindropItem[]> {
  const page = opts.page ?? 0
  const perpage = Math.min(opts.perpage ?? 50, 50)

  const params = new URLSearchParams({
    sort: "-created",
    page: String(page),
    perpage: String(perpage),
  })
  if (opts.sinceDate) {
    params.set("search", `created:>${opts.sinceDate}`)
  }

  const res = await fetchWithTimeout(
    `${BASE_URL}/raindrops/${collectionId}?${params.toString()}`,
    { headers: authHeaders() },
    RAINDROP_TIMEOUT_MS,
  )
  if (!res.ok) {
    throw new Error(`Raindrop raindrops failed: ${res.status} ${await res.text().catch(() => "")}`)
  }
  const data = (await res.json()) as RaindropListResponse
  return data.items ?? []
}

/**
 * Busca todas as páginas de raindrops (collectionId=0 → todas, exceto Trash)
 * desde `sinceDate`, parando quando uma página vier vazia. Para volume de
 * usuário único, raramente passa de 1-2 páginas.
 */
/**
 * Busca todas as páginas de raindrops de CADA collection-alvo desde `sinceDate`.
 *
 * Buscar por collection individual (e não `collectionId=0` = todas) evita que
 * uma collection pessoal grande (ex: "unread" com milhares de itens) afogue o
 * backlog das collections técnicas — o escopo de cada chamada é exato.
 */
export async function listAllRaindropsSince(sinceDate: string): Promise<RaindropItem[]> {
  const all: RaindropItem[] = []
  for (const collectionId of getCollectionIds()) {
    let page = 0
    // Teto de segurança: 20 páginas (1000 itens) por collection — nunca deve ser atingido.
    while (page < 20) {
      const items = await listRaindrops(String(collectionId), { sinceDate, page, perpage: 50 })
      if (items.length === 0) break
      all.push(...items)
      if (items.length < 50) break
      page++
    }
  }
  return all
}

/** IDs das collections-alvo (conhecimento técnico), parseados da env var. */
export function getCollectionIds(): number[] {
  return RAINDROP_COLLECTION_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n))
}

/** O item pertence a uma das collections-alvo? (exclui "Ler depois" etc.) */
export function isInTargetCollections(item: RaindropItem): boolean {
  const ids = new Set(getCollectionIds())
  return item.collection ? ids.has(item.collection.$id) : false
}

/** Deve o item ser pulado por não ter texto extraível (imagem/áudio)? */
export function isSkippableType(item: RaindropItem): boolean {
  return SKIP_TYPES.has(item.type)
}

export function hasToken(): boolean {
  return RAINDROP_TOKEN.length > 0
}

export function hasCollectionIds(): boolean {
  return getCollectionIds().length > 0
}
