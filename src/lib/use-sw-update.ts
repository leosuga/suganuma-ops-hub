"use client"

import { useEffect, useState } from "react"

export type SwUpdateState = "idle" | "available"

/**
 * Detecta nova versão do Service Worker e expõe callback para aplicá-la.
 *
 * Fluxo: registration.onupdatefound → novo SW em "installing" → aguarda
 * estado "activated"/redundant no_waiting. Quando há update esperando,
 * o banner "NOVA VERSÃO" aparece; ao tocar, envia SKIP_WAITING e recarrega
 * no controllerchange (quando o novo SW assume).
 */
export function useSwUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let reloading = false

    function onControllerChange() {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    async function trackRegistration(reg: ServiceWorkerRegistration) {
      // Caso 1: update chega enquanto a página está aberta
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener("statechange", () => {
          // "installed" = novo SW esperando ativação (waiting)
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      })
    }

    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).then((reg) => {
      void trackRegistration(reg)
      // Caso 2: update chegou antes do registro desta sessão
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }
    }).catch(() => {})

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
    return () => {
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