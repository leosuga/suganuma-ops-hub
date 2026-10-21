import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suganuma Ops Hub",
    short_name: "Ops Hub",
    description: "Personal command center — tasks, finance, health",
    // Entrada = Cockpit (decisão do backlog 2026-08: "Cockpit vira a entrada
    // diária (ação), Dashboard fica com métricas"). O Dashboard continua
    // acessível pelo link no header do Cockpit.
    start_url: "/cockpit",
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
    // Web Share Target (iOS 16.4+ / PWA instalada): compartilhar um texto,
    // link ou nota de QUALQUER app para o Ops Hub cai em /api/capture, que
    // joga direto no Inbox. É o caminho de captura mais curto que existe no
    // celular — sem abrir o app.
    share_target: {
      action: "/api/capture",
      method: "POST",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
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
        name: "Bebê",
        short_name: "Bebê",
        url: "/baby",
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
