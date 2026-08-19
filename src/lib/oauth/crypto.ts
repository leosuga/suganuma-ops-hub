// Helpers criptográficos compartilhados pelo authorization server.
// Usa Web Crypto (disponível no runtime Node 20+ e no Edge).

export async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** base64url do SHA-256 — formato exigido pelo PKCE S256 (RFC 7636 §4.2). */
export async function sha256base64url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return base64url(new Uint8Array(buf))
}

export function base64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Gera um segredo aleatório com prefixo. 32 bytes = 256 bits de entropia. */
export function randomSecret(prefix: string): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `${prefix}${base64url(bytes)}`
}

/**
 * Comparação de strings em tempo constante.
 * Evita distinguir segredos por tempo de resposta.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
