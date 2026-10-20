import { redirect } from "next/navigation"

export default function Home() {
  // Alinhado com o manifest (start_url: /dashboard) e com a ordem da nav
  // (DASH em 1º). Antes caía em /tasks e a PWA abria em /dashboard.
  redirect("/dashboard")
}
