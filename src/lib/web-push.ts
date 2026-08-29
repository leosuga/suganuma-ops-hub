// Web Push (VAPID) — envio server-side de notificações que funcionam com o
// app FECHADO (diferente de `new Notification()` que exige a aba aberta).
//
// iOS 16.4+ PWA instalado suporta push. Chrome/Firefox suportam sempre.
// Chaves: WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY
// (gerar uma vez: npx web-push generate-vapid-keys)
//
// O client se inscreve via pushManager.subscribe (user gesture em Settings)
// e grava a subscription em push_subscription (migration 0039).

import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"

const PUBLIC_KEY = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || ""
const PRIVATE_KEY = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
const CONTACT = process.env.WEB_PUSH_CONTACT || "mailto:ops@suganuma.com.br"

export function isWebPushConfigured(): boolean {
  return PUBLIC_KEY.length > 0 && PRIVATE_KEY.length > 0
}

export function getPublicKey(): string {
  return PUBLIC_KEY
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

async function ensureConfigured() {
  if (!isWebPushConfigured()) {
    throw new Error("Web Push não configurado (WEB_PUSH_VAPID_* ausentes)")
  }
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY)
}

/**
 * Envia push para TODAS as subscriptions ativas do dono.
 * Remove subscriptions inválidas (endpoint gone / 410 do push service).
 */
export async function sendPushToOwner(
  ownerId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  await ensureConfigured()

  const supabase = createServiceClient()
  const { data: subs, error } = await supabase
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth")
    .eq("owner_id", ownerId)

  if (error) throw new Error(error.message)
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 }

  let sent = 0
  const invalidIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 }, // 1h — notificação velha não é útil
        )
        sent++
        // best-effort last_used_at
        void supabase
          .from("push_subscription")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id)
          .then(() => {})
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          invalidIds.push(sub.id)
        } else {
          logger.warn("web-push", "Falha no envio (não-fatal)", { status, endpoint: sub.endpoint.slice(0, 40) })
        }
      }
    })
  )

  if (invalidIds.length > 0) {
    await supabase.from("push_subscription").delete().in("id", invalidIds)
  }

  return { sent, removed: invalidIds.length }
}