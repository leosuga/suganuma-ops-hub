import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { collectionExists, checkQdrantHealth } from "@/lib/qdrant"

const OWNER_ID_FALLBACK = process.env.WEBHOOK_OWNER_ID || ""

export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("profile").select("id").limit(1)
    if (error) throw error

    // Qdrant: saúde do serviço + contagem de pontos de forma NÃO bloqueante
    // (a app funciona sem busca vetorial — fallback FTS). Falha degrada o
    // status para "degraded" mas mantém 200: /api/health é usado pelo
    // HEALTHCHECK do container e por monitores externos.
    let qdrant: "ok" | "error" | "unavailable" = "unavailable"
    let notesIndexed: number | null = null
    try {
      const [healthy, exists] = await Promise.all([checkQdrantHealth(), collectionExists()])
      if (healthy && exists) {
        const ownerId = OWNER_ID_FALLBACK
        if (ownerId) {
          const { qdrantRequest } = await import("@/lib/qdrant")
          const { status, json } = await qdrantRequest<{ count?: number }>(
            "POST",
            "/collections/ops_hub_notes/points/count",
            {
              exact: true,
              filter: { must: [{ key: "owner_id", match: { value: ownerId } }] },
            },
          )
          if (status === 200) {
            qdrant = "ok"
            notesIndexed = json?.count ?? null
          } else {
            qdrant = "error"
          }
        } else {
          qdrant = "ok"
        }
      } else if (healthy) {
        // saudável mas coleção não existe (primeira run antes do reconcile)
        qdrant = "ok"
      } else {
        qdrant = "error"
      }
    } catch {
      qdrant = "error"
    }

    return NextResponse.json({
      status: "ok",
      db: "ok",
      qdrant,
      ...(notesIndexed !== null ? { notesIndexed } : {}),
      version: process.env.npm_package_version ?? "0.1.0",
    })
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 })
  }
}