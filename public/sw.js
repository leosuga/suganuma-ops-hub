const CACHE = "ops-hub-v4"
const STATIC_ASSETS = "/_next/static/"

self.addEventListener("install", (e) => {
  console.log("[SW] install v4")
  e.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (e) => {
  console.log("[SW] activate v4")
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

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // API e Supabase: sempre network
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return
  }

  // Assets estáticos do Next.js: CacheFirst (nunca mudam)
  if (url.pathname.startsWith(STATIC_ASSETS)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res.ok && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Navegação (documentos HTML): NetworkOnly
  // NÃO cacheamos navegação. O middleware do Next.js pode retornar
  // 307 redirect dependendo do estado de auth. Cachear isso quebra o app.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request))
    return
  }

  // Outros assets (scripts, styles, imagens, fonts fora de _next/static):
  // StaleWhileRevalidate, mas só cacheia se status === 200
  if (
    ["style", "script", "image", "font"].includes(e.request.destination)
  ) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const network = fetch(e.request).then((res) => {
            if (res.ok && res.status === 200) {
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
