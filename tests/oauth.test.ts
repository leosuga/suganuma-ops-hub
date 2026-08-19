import { describe, it, expect } from "vitest"
import { sha256base64url, base64url, timingSafeEqualStr, randomSecret } from "@/lib/oauth/crypto"
import { redirectUriMatches } from "@/lib/oauth/clients"
import { buildRedirect } from "@/lib/oauth/request"
import { authorizationServerMetadata, protectedResourceMetadata } from "@/lib/oauth/config"

describe("PKCE S256", () => {
  it("reproduz o vetor de teste do RFC 7636 apêndice B", async () => {
    // O RFC define este par verifier → challenge exato.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    const challenge = await sha256base64url(verifier)
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
  })

  it("gera challenge sem padding e url-safe", async () => {
    const challenge = await sha256base64url("qualquer-verifier-aleatorio")
    expect(challenge).not.toContain("=")
    expect(challenge).not.toContain("+")
    expect(challenge).not.toContain("/")
  })

  it("verifier errado produz challenge diferente", async () => {
    const a = await sha256base64url("verifier-correto")
    const b = await sha256base64url("verifier-errado")
    expect(a).not.toBe(b)
  })
})

describe("base64url", () => {
  it("codifica sem padding e com alfabeto url-safe", () => {
    const bytes = new Uint8Array([251, 255, 190, 0, 1, 2])
    const encoded = base64url(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe("timingSafeEqualStr", () => {
  it("compara iguais e diferentes corretamente", () => {
    expect(timingSafeEqualStr("abc", "abc")).toBe(true)
    expect(timingSafeEqualStr("abc", "abd")).toBe(false)
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false)
    expect(timingSafeEqualStr("", "")).toBe(true)
  })
})

describe("randomSecret", () => {
  it("aplica o prefixo e não repete", () => {
    const a = randomSecret("opsa_")
    const b = randomSecret("opsa_")
    expect(a.startsWith("opsa_")).toBe(true)
    expect(a).not.toBe(b)
    // 32 bytes em base64url = 43 chars
    expect(a.length).toBe("opsa_".length + 43)
  })
})

describe("redirectUriMatches", () => {
  it("exige match exato para URLs https", () => {
    expect(
      redirectUriMatches("https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback")
    ).toBe(true)
    expect(
      redirectUriMatches("https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/outro")
    ).toBe(false)
    expect(
      redirectUriMatches("https://claude.ai/api/mcp/auth_callback", "https://evil.com/api/mcp/auth_callback")
    ).toBe(false)
  })

  it("ignora a porta em loopback (RFC 8252 §7.3)", () => {
    expect(redirectUriMatches("http://localhost/callback", "http://localhost:3118/callback")).toBe(true)
    expect(redirectUriMatches("http://127.0.0.1/callback", "http://127.0.0.1:51234/callback")).toBe(true)
  })

  it("não confunde hosts nem paths diferentes em loopback", () => {
    expect(redirectUriMatches("http://localhost/callback", "http://127.0.0.1:3118/callback")).toBe(false)
    expect(redirectUriMatches("http://localhost/callback", "http://localhost:3118/outro")).toBe(false)
  })

  it("não trata host não-loopback como loopback", () => {
    expect(redirectUriMatches("http://localhost/callback", "http://evil.com:80/callback")).toBe(false)
  })
})

describe("buildRedirect", () => {
  it("preserva o state e ignora valores vazios", () => {
    const url = buildRedirect("https://claude.ai/api/mcp/auth_callback", {
      code: "opsc_abc",
      state: "xyz",
      error: null,
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.get("code")).toBe("opsc_abc")
    expect(parsed.searchParams.get("state")).toBe("xyz")
    expect(parsed.searchParams.has("error")).toBe(false)
  })

  it("mantém query já existente no redirect_uri", () => {
    const url = buildRedirect("https://example.com/cb?foo=1", { code: "c" })
    const parsed = new URL(url)
    expect(parsed.searchParams.get("foo")).toBe("1")
    expect(parsed.searchParams.get("code")).toBe("c")
  })
})

describe("documentos de discovery", () => {
  it("anuncia o que o Claude precisa para escolher CIMD", () => {
    const meta = authorizationServerMetadata()
    expect(meta.client_id_metadata_document_supported).toBe(true)
    expect(meta.token_endpoint_auth_methods_supported).toContain("none")
    expect(meta.code_challenge_methods_supported).toEqual(["S256"])
    expect(meta.grant_types_supported).toContain("refresh_token")
  })

  it("anuncia offline_access para que o refresh token seja emitido", () => {
    expect(authorizationServerMetadata().scopes_supported).toContain("offline_access")
  })

  it("aponta o resource para o endpoint MCP e o AS para o issuer", () => {
    const prm = protectedResourceMetadata()
    const meta = authorizationServerMetadata()
    expect(prm.resource).toBe(`${meta.issuer}/api/mcp`)
    expect(prm.authorization_servers).toEqual([meta.issuer])
    expect(prm.bearer_methods_supported).toEqual(["header"])
  })
})
