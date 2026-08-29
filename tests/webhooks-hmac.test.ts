// Testes da fronteira de segurança dos webhooks: HMAC constant-time,
// idempotência e chave de evento. Um refator pequeno aqui quebrava
// verificação de assinatura silenciosamente — agora tem rede.
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"

import {
  verifyWebhookHmac,
  resolveWebhookOwnerId,
  checkWebhookIdempotency,
  deriveEventKey,
} from "@/lib/webhooks/hmac"

const MockService = createServiceClient as unknown as ReturnType<typeof vi.fn>

function chain(value: unknown, error?: string): { then: (resolve: (v: unknown) => void) => Promise<void> } {
  const result = error ? { data: null, error: { message: error } } : { data: value, error: null }
  function wrap(): unknown {
    const proxy: Record<string, unknown> = {}
    return new Proxy(proxy, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
        }
        return () => wrap()
      },
    })
  }
  return wrap()
}

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  return "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function requestWithSignature(sig: string): Request {
  return new Request("https://example.com/api/webhooks/test", {
    method: "POST",
    headers: { "x-hub-signature-256": sig },
  })
}

describe("verifyWebhookHmac", () => {
  const BODY = '{"event":"test"}'
  const SECRET = "test-secret"

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WEBHOOK_SECRET = SECRET
  })

  it("aceita assinatura válida (secret default)", async () => {
    const sig = await sign(SECRET, BODY)
    const ok = await verifyWebhookHmac(requestWithSignature(sig), BODY)
    expect(ok).toBe(true)
  })

  it("aceita assinatura válida via secretOverride", async () => {
    const override = "other-secret"
    const sig = await sign(override, BODY)
    const ok = await verifyWebhookHmac(requestWithSignature(sig), BODY, override)
    expect(ok).toBe(true)
  })

  it("rejeita assinatura com secret errado", async () => {
    const sig = await sign("wrong-secret", BODY)
    const ok = await verifyWebhookHmac(requestWithSignature(sig), BODY)
    expect(ok).toBe(false)
  })

  it("rejeita body adulterado (tamper)", async () => {
    const sig = await sign(SECRET, BODY)
    const ok = await verifyWebhookHmac(requestWithSignature(sig), '{"event":"hacked"}')
    expect(ok).toBe(false)
  })

  it("rejeita header malformado (sem prefixo sha256=)", async () => {
    const ok = await verifyWebhookHmac(requestWithSignature("deadbeef"), BODY)
    expect(ok).toBe(false)
  })

  it("rejeita quando header ausente", async () => {
    const req = new Request("https://example.com/api/webhooks/test", { method: "POST" })
    const ok = await verifyWebhookHmac(req, BODY)
    expect(ok).toBe(false)
  })

  it("rejeita quando não há secret configurado", async () => {
    delete process.env.WEBHOOK_SECRET
    const sig = await sign(SECRET, BODY)
    const ok = await verifyWebhookHmac(requestWithSignature(sig), BODY)
    expect(ok).toBe(false)
  })

  it("override vence o secret default (segredo dedicado)", async () => {
    const sig = await sign(SECRET, BODY)
    const ok = await verifyWebhookHmac(requestWithSignature(sig), BODY, "dedicated-secret")
    expect(ok).toBe(false)
  })
})

describe("resolveWebhookOwnerId", () => {
  it("retorna o UUID quando WEBHOOK_OWNER_ID é válido", () => {
    process.env.WEBHOOK_OWNER_ID = "123e4567-e89b-12d3-a456-426614174000"
    expect(resolveWebhookOwnerId()).toBe("123e4567-e89b-12d3-a456-426614174000")
  })

  it("retorna null quando não é UUID (owner nunca vem do payload)", () => {
    process.env.WEBHOOK_OWNER_ID = "not-a-uuid"
    expect(resolveWebhookOwnerId()).toBeNull()
  })

  it("retorna null quando ausente", () => {
    delete process.env.WEBHOOK_OWNER_ID
    expect(resolveWebhookOwnerId()).toBeNull()
  })
})

describe("checkWebhookIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marca replay=true quando evento já existe", async () => {
    MockService.mockReturnValue({ from: () => chain([{ id: "row-1" }]) })
    const res = await checkWebhookIdempotency("email", "evt-1")
    expect(res.replay).toBe(true)
    expect(res.mark).toBeUndefined()
  })

  it("retorna mark() quando evento é novo", async () => {
    MockService.mockReturnValue({ from: () => chain(null) })
    const res = await checkWebhookIdempotency("email", "evt-2")
    expect(res.replay).toBe(false)
    expect(res.mark).toBeTypeOf("function")
    // mark() resolve sem lançar (insert no chain mock)
    await expect(res.mark?.()).resolves.toBeUndefined()
  })
})

describe("deriveEventKey", () => {
  it("é determinístico no mesmo body", async () => {
    const a = await deriveEventKey("payload")
    const b = await deriveEventKey("payload")
    expect(a).toBe(b)
  })

  it("difere entre bodies distintos", async () => {
    const a = await deriveEventKey("payload-1")
    const b = await deriveEventKey("payload-2")
    expect(a).not.toBe(b)
  })

  it("retorna hex de 64 chars (sha256)", async () => {
    const key = await deriveEventKey("x")
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })
})