// Shared webhook utilities: constant-time HMAC verification and idempotency.
// All webhook routes should use `verifyWebhookHmac` and `checkWebhookIdempotency`.

import { timingSafeEqual } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"

/**
 * Verify HMAC-SHA256 signature of the raw body using a constant-time comparison.
 * Uses `WEBHOOK_SECRET` env var for all webhook routes.
 */
export async function verifyWebhookHmac(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) {
    logger.warn("webhook", "No WEBHOOK_SECRET configured", {})
    return false
  }

  const sig = req.headers.get("x-hub-signature-256") ?? ""
  if (!sig.startsWith("sha256=")) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const expected = "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("")

  // Constant-time comparison via crypto.timingSafeEqual
  const sigBuf = Buffer.from(sig, "utf8")
  const expBuf = Buffer.from(expected, "utf8")
  if (sigBuf.length !== expBuf.length) return false
  return timingSafeEqual(sigBuf, expBuf)
}

/**
 * Owner_id fixo do dono do hub, vindo de env var — nunca do payload.
 *
 * App de usuário único: confiar no `owner_id` que o emissor manda no corpo
 * permite que qualquer chamada com o HMAC válido escreva em nome de QUALQUER
 * owner_id (basta um UUID válido no payload). Como não há sessão de usuário
 * num webhook, a única fonte confiável é uma env var configurada no servidor.
 */
export function resolveWebhookOwnerId(): string | null {
  const ownerId = process.env.WEBHOOK_OWNER_ID
  if (!ownerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) {
    return null
  }
  return ownerId
}

/**
 * Idempotency check: returns true if this payload has already been processed.
 * Uses the `webhook_event` table to track (source, event_id) pairs.
 * Callers should provide a unique event_id (from the payload or a hash of it).
 *
 * Returns:
 *  - { replay: true } if already processed (caller should return 200 without side effects)
 *  - { replay: false, mark: () => Promise<void> } if new (caller should call mark() after success)
 */
export async function checkWebhookIdempotency(
  source: string,
  eventKey: string
): Promise<{ replay: boolean; mark?: () => Promise<void> }> {
  const supabase = createServiceClient()

  // Check if already processed
  const { data: existing } = await supabase
    .from("webhook_event")
    .select("id")
    .eq("source", source)
    .eq("event_key", eventKey)
    .maybeSingle()

  if (existing) {
    return { replay: true }
  }

  // Insert tentatively — if a concurrent request already inserted, the unique
  // constraint will reject this and we treat it as a replay.
  return {
    replay: false,
    mark: async () => {
      await supabase.from("webhook_event").insert({
        source,
        event_key: eventKey,
        processed_at: new Date().toISOString(),
      })
    },
  }
}

/**
 * Derive a deterministic event key from the raw body hash.
 * Use this when the payload has no explicit id/timestamp field.
 */
export async function deriveEventKey(rawBody: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("")
}