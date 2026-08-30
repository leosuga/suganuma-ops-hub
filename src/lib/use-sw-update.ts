"use client"

import { useEffect, useState } from "react"

export type SwUpdateState = "idle" | "available"

/**
 * Detecta nova versão do Service Worker e expõe callback para aplicá-la.
 *
 * Casos cobertos:
 * 1. update chega enquanto a página está aberta (updatefound)
 * 2. update já estava waiting quando a página carregou
 * 3. página resumida do background (visibilitychange) → reg.update() força
 *    fetch do sw.js — cobre iOS standalone que "rescita" sem reload
 * 4. polling de 60s como rede de segurança (deploys sem interação do usuário)
 *
 * Bootstrap: o detector só roda com o JS novo carregado. A 1ª experiência
 * pós-deploy que introduz este código exige UM reload manual; dali em diante
 * os banners aparecem sozinhos.
 */
export function useSwUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let reloading = false
    let disposed = false

    function onControllerChange() {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    function onStatechange(this: ServiceWorker) {
      // "installed" = novo SW esperando ativação (waiting)
      if (this.state === "installed" && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }
    }

    function trackRegistration(reg: ServiceWorkerRegistration) {
      if (disposed) return

      // Caso 1: update chega enquanto a página está aberta
      reg.addEventListener("updatefound", () => {
        reg.installing?.addEventListener("statechange", onStatechange)
      })

      // Caso 2: update já waiting no load
      reg.waiting?.addEventListener("statechange", onStatechange)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }

      // Casos 3+4: forçar checagem periódica e ao voltar ao app
      const check = () => {
        if (disposed || document.visibilityState !== "visible") return
        reg.update().catch(() => {})
      }
      const interval = setInterval(check, 60_000)
      document.addEventListener("visibilitychange", check)
      const cleanup = () => {
        clearInterval(interval)
        document.removeEventListener("visibilitychange", check)
      }
      // registra cleanup anexado ao disposal do hook
      ;(reg as ServiceWorkerRegistration & { __cleanup?: () => void }).__cleanup = cleanup
      window.addEventListener("pagehide", cleanup, { once: true })
    }

    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).then((reg) => {
      if (disposed && (reg as ServiceWorkerRegistration & { __cleanup?: () => void }).__cleanup) {
        ;(reg as ServiceWorkerRegistration & { __cleanup?: () => void }).__cleanup?.()
        return
      }
      trackRegistration(reg)
    }).catch(() => {})

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
    return () => {
      disposed = true
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  function applyUpdate() {
    navigator.serviceWorker?.controller?.postMessage("SKIP_WAITING")
    // controllerchange dispara o reload; fallback se o evento não vier
    setTimeout(() => {
      window.location.reload()
    }, 3000)
  }

  return { updateAvailable, applyUpdate }
}

/**
 * true quando o navegador está offline. Atualiza com os eventos
 * online/offline do browser.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  return online
}