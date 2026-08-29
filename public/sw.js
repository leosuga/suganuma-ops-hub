const CACHE = "ops-hub-v18"
const OFFLINE_PAGE = "/offline.html"
const STATIC_ASSETS = "/_next/static/"
// Fallback de navegação offline: última página 200 servida (shell client-side).
const LAST_GOOD_PAGE = "last-good-html"

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== LAST_GOOD_PAGE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isNavigate(req) {
  return req.mode === "navigate"
}

function isStaticAsset(url) {
  return url.pathname.startsWith(STATIC_ASSETS)
}

function isApi(url) {
  return url.pathname.startsWith("/api/") || url.hostname.includes("supabase")
}

function isAsset(req) {
  return ["style", "script", "image", "font"].includes(req.destination)
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // API e Supabase: sempre network
  if (isApi(url)) return

  // Assets estáticos do Next.js: NetworkFirst (para deploys frequentes)
  // Sempre busca a rede primeiro; se offline, fallback para cache
  if (isStaticAsset(url)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => {
          return caches.match(e.request).then((cached) => {
            if (cached) return cached
            // Se não está no cache e offline, retorna 503
            return new Response("Offline", { status: 503, statusText: "Service Unavailable" })
          })
        })
    )
    return
  }

  // Navegação (HTML): network-first com fallback em camadas.
  //
  // 1. Online: resposta 200 é servida E cacheada como "última página boa"
  //    (clone em cache separado LAST_GOOD_PAGE). NUNCA cacheamos redirects
  //    (307 para /login) nem erros — o bug documentado de 2026-06.
  // 2. Offline: tenta a última página boa (shell client-side renderiza com os
  //    dados do TanStack persistido — experiência muito melhor que offline.html).
  // 3. Sem página cacheada: offline.html estático.
  if (isNavigate(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone()
            caches.open(LAST_GOOD_PAGE).then((c) => c.put("/__last-good", copy))
          }
          return res
        })
        .catch(() =>
          caches
            .match("/__last-good", { cacheName: LAST_GOOD_PAGE })
            .then((last) => last ?? caches.match(OFFLINE_PAGE))
        )
    )
    return
  }

  // Outros assets (fonts, imagens, etc.): StaleWhileRevalidate
  if (isAsset(e.request)) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const network = fetch(e.request).then((res) => {
            if (res.ok) {
              cache.put(e.request, res.clone())
            }
            return res
          })
          return cached ?? network
        })
      )
    )
  }
})

// Mensagem do app para forçar update
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

// Web Push (VAPID) — notificações que funcionam com o app FECHADO.
// Payload: { title, body, tag?, url? }
self.addEventListener("push", (e) => {
  let data = { title: "Ops Hub", body: "", url: "/dashboard" }
  try {
    data = { ...data, ...(e.data ? e.data.json() : {}) }
  } catch {
    data.body = e.data ? e.data.text() : ""
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/dashboard" },
      requireInteraction: true,
    })
  )
})

// Click na notificação → abre/foca a URL associada
self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || "/dashboard"
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(target) && "focus" in client) return client.focus()
      }
      for (const client of clients) {
        if ("focus" in client) return client.navigate(target).then((c) => c && c.focus())
      }
      return self.clients.openWindow(target)
    })
  )
})
