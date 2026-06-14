// Internal API client used by MCP tool handlers to call /api/agent/* endpoints

const DEFAULT_BASE_URL = "http://127.0.0.1:3000"

function getBaseUrl(): string {
  // In production Docker container, internal requests to localhost work.
  // For external MCP server or tests, caller can override via env (not used here).
  return process.env.OPS_HUB_INTERNAL_URL ?? DEFAULT_BASE_URL
}

export async function agentApi<T = unknown>(
  token: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string | undefined>
): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = new URL(path, baseUrl)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error")
    throw new Error(`Agent API error ${res.status}: ${text}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}
