const CACHE = "ops-hub-v1"
const PRECACHE = ["/", "/dashboard", "/tasks", "/finance", "/health"]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // API e Supabase: sempre network
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return
  }

  // Navegação: NetworkFirst (tenta rede, fallback cache)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then((r) => r ?? caches.match("/")))
    )
    return
  }

  // Assets estáticos: StaleWhileRevalidate
  if (["style", "script", "image", "font"].includes(e.request.destination)) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const network = fetch(e.request).then((res) => {
            cache.put(e.request, res.clone())
            return res
          })
          return cached ?? network
        })
      )
    )
  }
})
