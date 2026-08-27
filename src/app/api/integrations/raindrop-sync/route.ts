// POST /api/integrations/raindrop-sync
//
// Ponte de curadoria automática Raindrop → Hub Notes (Variante C):
//   - reference  → cria nota (resumo + tags + link) via createNoteWithEmbedding
//   - actionable → insere inbox_item (source='raindrop') para triagem no Cockpit
//
// Auth: HMAC com RAINDROP_SYNC_SECRET (secret dedicado, não o WEBHOOK_SECRET).
// owner_id: fixo via WEBHOOK_OWNER_ID (nunca do payload).
// Idempotente: dedup por raindrop_id via checkWebhookIdempotency("raindrop", id).

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { verifyWebhookHmac, checkWebhookIdempotency, resolveWebhookOwnerId } from "@/lib/webhooks/hmac"
import { createNoteWithEmbedding } from "@/lib/actions/notes"
import { chatCompletion } from "@/lib/ollama"
import { logger } from "@/lib/logger"
import {
  hasToken,
  hasCollectionIds,
  listAllRaindropsSince,
  isInTargetCollections,
  isSkippableType,
  getCollectionTitleMap,
  collectionSlug,
  type RaindropItem,
} from "@/lib/raindrop"

const CURSOR_TAG = "raindrop-sync-state"
const MAX_ITEMS_PER_RUN = Number(process.env.RAINDROP_MAX_ITEMS_PER_RUN ?? "50")

// ── Cursor (nota pinned com tag raindrop-sync-state) ────────────────────────

async function readCursor(ownerId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("note")
    .select("content")
    .eq("owner_id", ownerId)
    .contains("tags", [CURSOR_TAG])
    .maybeSingle()

  if (error || !data?.content) return null
  return isNaN(Date.parse(data.content)) ? null : data.content
}

async function writeCursor(ownerId: string, timestamp: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from("note")
    .select("id")
    .eq("owner_id", ownerId)
    .contains("tags", [CURSOR_TAG])
    .maybeSingle()

  if (existing) {
    await supabase.from("note").update({ content: timestamp }).eq("id", existing.id)
  } else {
    await supabase.from("note").insert({
      owner_id: ownerId,
      title: "Raindrop Sync State",
      content: timestamp,
      tags: [CURSOR_TAG],
      pinned: true,
    })
  }
}

/** Converte cursor (ISO) em "YYYY-MM-DD" do dia anterior, para o filtro nativo
 *  `created:>YYYY-MM-DD` (estritamente "depois de"), re-buscando o dia do cursor
 *  e deixando a borda para o filtro client-side + dedup. */
function cursorToSinceDate(cursor: string): string {
  const d = new Date(cursor)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ── Classificação LLM (reference vs actionable) ─────────────────────────────

interface Classification {
  kind: "reference" | "actionable"
  summary: string
  tags: string[]
  action_items: string[]
}

const CLASSIFY_SYSTEM = `Você classifica bookmarks salvos no Raindrop para um sistema de conhecimento pessoal.
Dado um link salvo (título + excerpt + tags), decida o destino:

- "reference": material para guardar/consultar (artigo, documentação, referência, conceito, pesquisa).
- "actionable": implica uma ação a tomar (tutorial para aplicar, ferramenta para testar, curso para fazer, tarefa).

Regras:
1. Na dúvida, prefira "actionable" — um item que deveria ser revisado é pior que ruído no inbox.
2. Escreva um resumo de 1-2 linhas (usado apenas se for reference).
3. Sugira 1-3 tags curtas (sem #, minúsculas).
4. Se for actionable, liste 1-3 ações físicas concretas.

Responda APENAS em JSON válido:
{ "kind": "reference" | "actionable", "summary": "resumo", "tags": ["tag1"], "action_items": ["ação 1"] }`

async function classifyItem(item: RaindropItem): Promise<Classification> {
  const userPrompt = `Título: ${item.title}
URL: ${item.link}
Excerpt: ${item.excerpt || "(sem excerpt)"}
Tags do Raindrop: ${(item.tags ?? []).join(", ") || "(sem tags)"}
${item.note ? `Nota do usuário: ${item.note}` : ""}
${item.highlights?.length ? `Highlights: ${item.highlights.map((h) => h.text).join(" | ")}` : ""}`

  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { format: "json", temperature: 0.2 }
    )

    let parsed: Partial<Classification>
    try {
      parsed = JSON.parse(raw)
    } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (!m) throw new Error("LLM não retornou JSON")
      parsed = JSON.parse(m[0])
    }

    return {
      kind: parsed.kind === "actionable" ? "actionable" : "reference",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string") : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items.filter((a) => typeof a === "string") : [],
    }
  } catch (err) {
    // Fallback: sem resumo, trata como reference (título + link + tags).
    logger.warn("raindrop-sync", "Classificação falhou, fallback para reference", {
      id: item._id,
      error: (err as Error).message,
    })
    return { kind: "reference", summary: "", tags: [], action_items: [] }
  }
}

// ── Roteamento ──────────────────────────────────────────────────────────────

async function routeReference(ownerId: string, item: RaindropItem, c: Classification, collectionTitle: string) {
  const content = [c.summary, "", `Fonte: ${item.link}`].filter(Boolean).join("\n")
  const collectionTag = collectionSlug(collectionTitle)
  const tags = Array.from(new Set(["raindrop", collectionTag, ...c.tags])).filter(Boolean)
  await createNoteWithEmbedding(ownerId, {
    title: item.title.slice(0, 500),
    content,
    tags,
    para: "resources",
  })
}

async function routeActionable(ownerId: string, item: RaindropItem, collectionTitle: string) {
  const supabase = createServiceClient()
  const content = [
    collectionTitle ? `[${collectionTitle}]` : "",
    item.title,
    item.link,
    item.excerpt,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000)
  const { error } = await supabase.from("inbox_item").insert({
    owner_id: ownerId,
    content,
    source: "raindrop",
  })
  if (error) throw new Error(error.message)
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyWebhookHmac(req, rawBody, process.env.RAINDROP_SYNC_SECRET))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  const ownerId = resolveWebhookOwnerId()
  if (!ownerId) {
    logger.error("raindrop-sync", "WEBHOOK_OWNER_ID não configurado", {})
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 })
  }

  if (!hasToken() || !hasCollectionIds()) {
    logger.error("raindrop-sync", "RAINDROP_TOKEN/RAINDROP_COLLECTION_IDS não configurados", {})
    return NextResponse.json({ error: "Integração Raindrop não configurada" }, { status: 500 })
  }

  const cursor = await readCursor(ownerId)
  const sinceDate = cursor ? cursorToSinceDate(cursor) : undefined

  let items: RaindropItem[]
  try {
    items = await listAllRaindropsSince(sinceDate ?? "")
  } catch (err) {
    logger.error("raindrop-sync", "Falha ao buscar raindrops", { error: (err as Error).message })
    return NextResponse.json({ error: "Falha ao buscar raindrops" }, { status: 502 })
  }

  // Filtro client-side: só collections-alvo + timestamp (precisão) + ordenação
  // oldest-first para avançar o cursor corretamente com o cap de itens por run.
  const newItems = items
    .filter(isInTargetCollections)
    .filter((i) => !cursor || i.created > cursor)
    .sort((a, b) => a.created.localeCompare(b.created))
    .slice(0, MAX_ITEMS_PER_RUN)

  // Mapa collectionId → título, para tag automática com o nome da collection.
  const titleMap = await getCollectionTitleMap().catch(() => new Map<number, string>())

  let notesCreated = 0
  let inboxCreated = 0
  let skipped = 0
  let failed = 0

  for (const item of newItems) {
    if (isSkippableType(item)) {
      skipped++
      continue
    }

    const idempotency = await checkWebhookIdempotency("raindrop", String(item._id))
    if (idempotency.replay) {
      skipped++
      continue
    }

    const collectionTitle = item.collection ? (titleMap.get(item.collection.$id) ?? "") : ""

    try {
      const classification = await classifyItem(item)
      if (classification.kind === "actionable") {
        await routeActionable(ownerId, item, collectionTitle)
        inboxCreated++
      } else {
        await routeReference(ownerId, item, classification, collectionTitle)
        notesCreated++
      }
      await idempotency.mark?.()
    } catch (err) {
      failed++
      logger.error("raindrop-sync", "Falha ao processar item", {
        id: item._id,
        error: (err as Error).message,
      })
    }
  }

  // Avança o cursor para o item mais recente processado (max created do batch).
  if (newItems.length > 0) {
    const maxCreated = newItems.reduce((m, i) => (i.created > m ? i.created : m), newItems[0].created)
    await writeCursor(ownerId, maxCreated)
  }

  logger.info("raindrop-sync", "Sincronização concluída", {
    fetched: items.length,
    processed: newItems.length,
    notesCreated,
    inboxCreated,
    skipped,
    failed,
  })

  return NextResponse.json({
    ok: true,
    fetched: items.length,
    processed: newItems.length,
    notes_created: notesCreated,
    inbox_created: inboxCreated,
    skipped,
    failed,
  })
}
