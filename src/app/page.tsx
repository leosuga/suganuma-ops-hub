import { redirect } from "next/navigation"

export default function Home() {
  // Alinhado com o manifest (start_url: /cockpit) e com a decisão do
  // backlog: o Cockpit é a entrada diária (ação); o Dashboard é de métricas.
  redirect("/cockpit")
}
