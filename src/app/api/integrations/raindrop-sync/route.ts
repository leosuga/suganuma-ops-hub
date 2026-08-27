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

const CLASSIFY_SYSTEM = `Você classifica bookmarks salvos no Raindrop (coleção de conhecimento técnico) para um sistema de conhecimento pessoal.
Dado um link salvo (título + excerpt + tags), decida o destino:

- "reference": material para GUARDAR e consultar depois — artigos, tutoriais, guias, comparativos, documentação, conceitos, técnicas, opiniões/análises, estudos de caso.
- "actionable": APENAS quando o conteúdo pede uma ação concreta e próxima — ferramenta para testar/adotar agora, curso ou evento com inscrição, vaga interessante, tarefa específica que o próprio conteúdo impõe.

Você receberá uma lista NUMERADA de bookmarks. Classifique TODOS e responda APENAS em JSON válido:
{ "items": [ { "index": 0, "kind": "reference" | "actionable", "summary": "resumo", "tags": ["tag1"], "action_items": ["ação 1"] } ] }

Regras:
1. Inclua um objeto para CADA index da lista, sem pular nem duplicar.
2. Na dúvida, prefira "reference" — tutorial salvo é conhecimento para consultar, não tarefa. Um inbox poluído de itens que nunca serão triados é pior que uma nota a mais.
3. Escreva um resumo de 1-2 linhas em português (usado apenas se for reference).
4. Sugira 1-3 tags curtas temáticas (sem #, minúsculas, em inglês quando for termo técnico).
5. Se for actionable, liste 1-3 ações físicas concretas.`

const LLM_BATCH_SIZE = 20

const FALLBACK_CLASSIFICATION: Classification = {
  kind: "reference",
  summary: "",
  tags: [],
  action_items: [],
}

function normalizeClassification(parsed: Partial<Classification>): Classification {
  return {
    kind: parsed.kind === "actionable" ? "actionable" : "reference",
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string") : [],
    action_items: Array.isArray(parsed.action_items)
      ? parsed.action_items.filter((a) => typeof a === "string")
      : [],
  }
}

function formatItem(item: RaindropItem, index: number): string {
  return `[${index}] Título: ${item.title}
URL: ${item.link}
Excerpt: ${item.excerpt || "(sem excerpt)"}
Tags do Raindrop: ${(item.tags ?? []).join(", ") || "(sem tags)"}${item.note ? `\nNota do usuário: ${item.note}` : ""}${item.highlights?.length ? `\nHighlights: ${item.highlights.map((h) => h.text).join(" | ")}` : ""}`
}

/**
 * Classifica itens em lote: 1 chamada LLM por chunk de LLM_BATCH_SIZE itens
 * (em vez de 1 chamada por item), amortizando o system prompt e reduzindo
 * latência/chamadas em ~20x. Item sem classificação válida cai no fallback
 * (reference, sem resumo — título + link + tags).
 */
async function classifyItems(items: RaindropItem[]): Promise<{ classifications: Classification[]; llmCalls: number }> {
  const results = new Array<Classification>(items.length).fill(FALLBACK_CLASSIFICATION)
  let llmCalls = 0

  for (let start = 0; start < items.length; start += LLM_BATCH_SIZE) {
    const chunk = items.slice(start, start + LLM_BATCH_SIZE)

    // 1 retry por chunk em falha (JSON inválido/HTTP); 2a falha → fallback reference
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const userPrompt = `Bookmarks:\n${chunk.map((item, i) => formatItem(item, start + i)).join("\n\n")}\n\nClassifique cada um (indexes ${start} a ${start + chunk.length - 1}) em JSON:`

        const raw = await chatCompletion(
          [
            { role: "system", content: CLASSIFY_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          { format: "json", temperature: 0.2 }
        )
        llmCalls++

        let parsed: { items?: Array<Partial<Classification> & { index?: number }> }
        try {
          parsed = JSON.parse(raw)
        } catch {
          const m = raw.match(/\{[\s\S]*\}/)
          if (!m) throw new Error("LLM não retornou JSON")
          parsed = JSON.parse(m[0])
        }

        const returned = Array.isArray(parsed.items) ? parsed.items : []
        const byIndex = new Map<number, Classification>()
        returned.forEach((it, pos) => {
          // index explícito quando presente; senão, posicional se o comprimento bater
          const idx = typeof it?.index === "number" ? it.index : returned.length === chunk.length ? pos : -1
          if (idx >= start && idx < start + chunk.length) byIndex.set(idx, normalizeClassification(it))
        })

        for (let i = 0; i < chunk.length; i++) {
          const idx = start + i
          results[idx] = byIndex.get(idx) ?? FALLBACK_CLASSIFICATION
        }
        break // chunk ok — sai do loop de retries
      } catch (err) {
        if (attempt === 1) {
          logger.warn("raindrop-sync", "Chunk de classificação falhou 2x — fallback reference para o chunk", {
            size: chunk.length,
            error: (err as Error).message,
          })
        }
      }
    }
  }

  return { classifications: results, llmCalls }
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

  // 1ª passada: filtra tipos não-extraíveis e replay, coletando candidatos.
  const candidates: Array<{ item: RaindropItem; idem: Awaited<ReturnType<typeof checkWebhookIdempotency>>; collectionTitle: string }> = []
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

    candidates.push({
      item,
      idem: idempotency,
      collectionTitle: item.collection ? (titleMap.get(item.collection.$id) ?? "") : "",
    })
  }

  // 2ª passada: classificação em lote (1 chamada LLM por chunk de 20) e roteamento.
  const { classifications, llmCalls } = await classifyItems(candidates.map((c) => c.item))

  for (let i = 0; i < candidates.length; i++) {
    const { item, idem, collectionTitle } = candidates[i]
    try {
      const classification = classifications[i]
      if (classification.kind === "actionable") {
        await routeActionable(ownerId, item, collectionTitle)
        inboxCreated++
      } else {
        await routeReference(ownerId, item, classification, collectionTitle)
        notesCreated++
      }
      await idem.mark?.()
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
    llmCalls,
  })

  return NextResponse.json({
    ok: true,
    fetched: items.length,
    processed: newItems.length,
    notes_created: notesCreated,
    inbox_created: inboxCreated,
    skipped,
    failed,
    llm_calls: llmCalls,
  })
}
