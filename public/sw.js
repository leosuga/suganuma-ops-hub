const CACHE = "ops-hub-v10"
const OFFLINE_PAGE = "/offline.html"
const STATIC_ASSETS = "/_next/static/"

self.addEventListener("install", (e) => {
  console.log("[SW] install v8")
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  console.log("[SW] activate v6")
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
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

  // Assets estáticos do Next.js: CacheFirst
  if (isStaticAsset(url)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Navegação (HTML): NetworkFirst com fallback offline
  if (isNavigate(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) return res
          return caches.match(OFFLINE_PAGE)
        })
        .catch(() => caches.match(OFFLINE_PAGE))
    )
    return
  }

  // Outros assets: StaleWhileRevalidate
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

// Background sync para re-tentar requests de API que falharam
self.addEventListener("sync", (e) => {
  if (e.tag === "api-sync") {
    e.waitUntil(
      new Promise((resolve) => {
        console.log("[SW] background sync triggered")
        resolve(undefined)
      })
    )
  }
})

// Mensagem do app para forçar update
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
