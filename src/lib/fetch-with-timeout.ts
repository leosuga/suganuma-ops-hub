// Fetch com timeout via AbortController — evita requests pendurados
// (ollama.com, Qdrant, Raindrop) travando server actions e webhooks.
// Padrão já usado em src/lib/mcp/api.ts e src/app/oauth (CIMD, 5s).
//
// `cache: "no-store"` explícito: o Next.js cacheia fetch em Route Handlers /
// Server Components. Visto no bulk reconcile (2026-08-29): o POST de scroll do
// Qdrant voltava SEMPRE o mesmo resultado (mapa de hashes congelado) e PUTs
// nem sempre persistiam comportamento observável de cache — infra não é
// cacheável, nunca deixar o Next decidir.

export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    ...init,
    signal: controller.signal,
    cache: (init.cache as RequestCache) ?? "no-store",
  }).finally(() => clearTimeout(timer))
}