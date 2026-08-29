"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Web Push (VAPID) — notificações que funcionam com o app FECHADO.
 *
 * iOS 16.4+: exige PWA instalada (standalone) e permissão via GESTO do usuário
 * (botão em Settings, nunca no load).
 *
 * Fluxo:
 * 1. Componente busca a public key: GET /api/push
 * 2. Usuário clica "Ativar Push" → Notification.requestPermission() +
 *    pushManager.subscribe(userVisibleOnly: true, applicationServerKey: urlB64→Uint8Array)
 * 3. Subscription enviada: POST /api/push (upsert por endpoint)
 * 4. Server envia via web-push em eventos relevantes
 * 5. sw.js recebe o evento "push" e mostra a notificação
 */

const urlB64ToUint8Array = (b64: string): Uint8Array => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4)
  const normalized = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(normalized)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function getCurrentEndpoint(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  const sub = await reg.pushManager.getSubscription()
  return sub?.endpoint ?? null
}

export type PushState = "unsupported" | "unconfigured" | "default" | "granted" | "denied"

export function useWebPush() {
  const [state, setState] = useState<PushState>("unsupported")
  const [busy, setBusy] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported")
        return
      }
      try {
        const res = await fetch("/api/push")
        if (res.status === 501) {
          setState("unconfigured")
          return
        }
      } catch {
        setState("unsupported")
        return
      }
      if (cancelled) return

      const perm = Notification.permission
      if (perm === "denied") {
        setState("denied")
        return
      }
      if (perm === "granted") {
        const endpoint = await getCurrentEndpoint()
        if (!cancelled) {
          setState("granted")
          setEnabled(!!endpoint)
        }
        return
      }
      setState("default")
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default")
        return false
      }

      const res = await fetch("/api/push")
      if (!res.ok) {
        setState("unconfigured")
        return false
      }
      const { publicKey } = (await res.json()) as { publicKey: string }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as BufferSource,
      })

      const subJson = sub.toJSON()
      const save = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      })
      if (!save.ok) return false
      setState("granted")
      setEnabled(true)
      return true
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
      setEnabled(false)
      setState("default")
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, enabled, busy, enable, disable }
}