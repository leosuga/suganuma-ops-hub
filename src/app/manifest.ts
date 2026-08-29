import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suganuma Ops Hub",
    short_name: "Ops Hub",
    description: "Personal command center — tasks, finance, health",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#121212",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press no ícone da PWA instalada — atalho direto pra captura,
    // sem passar pela navegação normal.
    shortcuts: [
      {
        name: "Capturar no Inbox",
        short_name: "Inbox",
        url: "/inbox",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Nova Task",
        short_name: "Task",
        url: "/tasks",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  }
}
