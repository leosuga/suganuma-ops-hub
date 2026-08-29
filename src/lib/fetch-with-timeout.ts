// Fetch com timeout via AbortController — evita requests pendurados
// (ollama.com, Qdrant, Raindrop) travando server actions e webhooks.
// Padrão já usado em src/lib/mcp/api.ts e src/app/oauth (CIMD, 5s).

export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}