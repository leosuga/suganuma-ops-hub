"use server"

import { z } from "zod"
import { chatCompletion } from "@/lib/ollama"
import { embedText } from "@/lib/ollama"
import { ensureCollection, searchNotes } from "@/lib/qdrant"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

// Validação do output do LLM — o JSON mode não garante tipos (um campo pode
// vir como string onde esperamos array, etc.). Mesmo padrão do
// normalizeClassification do raindrop-sync: tipo errado vira fallback seguro.
const llmTriageSchema = z.object({
  suggested_type: z.enum(["task", "note", "idea", "reminder", "multiple"]).catch("task"),
  suggested_category: z.enum(["finance", "logistics", "personal", "health"]).nullable().catch(null),
  suggested_priority: z.enum(["low", "med", "high", "urgent"]).catch("med"),
  suggested_tags: z.array(z.string().trim().min(1).max(40)).max(10).catch([]),
  action_items: z.array(z.string().trim().min(1).max(500)).max(10).catch([]),
  summary: z.string().trim().max(500).catch(""),
})

export interface TriageResult {
  suggested_type: "task" | "note" | "idea" | "reminder" | "multiple"
  suggested_project_id: string | null
  suggested_project_name: string | null
  suggested_priority: "low" | "med" | "high" | "urgent"
  suggested_tags: string[]
  suggested_category: "finance" | "logistics" | "personal" | "health" | null
  action_items: string[]
  summary: string
  duplicates: Array<{ id: string; title: string; score: number; type: string }>
}

const SYSTEM_PROMPT = `Você é um assistente de triagem cognitiva para um sistema de produtividade pessoal (Suganuma Ops Hub).
Sua tarefa é analisar um pensamento bruto capturado no Inbox e sugerir como ele deve ser organizado.

Regras:
1. Detecte se o conteúdo é uma Tarefa (ação física executável), Ideia (conceito para explorar), Anotação (informação para registrar), Lembrete (algo para não esquecer), ou Múltiplos itens (vários pensamentos misturados).
2. Se for vago (ex: "preciso resolver a viagem"), quebre em ações físicas acionáveis (ex: "Pesquisar passagens", "Definir datas", "Reservar hotel").
3. Sugira a categoria mais provável: finance, logistics, personal, ou health.
4. Sugira a prioridade: low, med, high, ou urgent.
5. Sugira tags curtas (1-2 palavras, sem #).
6. Escreva um resumo de 1 linha.

Responda APENAS em JSON válido com este schema:
{
  "suggested_type": "task" | "note" | "idea" | "reminder" | "multiple",
  "suggested_category": "finance" | "logistics" | "personal" | "health" | null,
  "suggested_priority": "low" | "med" | "high" | "urgent",
  "suggested_tags": ["tag1", "tag2"],
  "action_items": ["ação 1", "ação 2"],
  "summary": "resumo de 1 linha"
}`

export async function triageInboxItem(itemId: string): Promise<{ ok: boolean; result?: TriageResult; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data: item, error } = await supabase
      .from("inbox_item")
      .select("*")
      .eq("id", itemId)
      .eq("owner_id", user.id)
      .single()
    if (error || !item) throw new Error("Inbox item not found")

    const { data: projects } = await supabase
      .from("project")
      .select("id, name")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .order("name")

    const projectList = projects?.map((p) => `- ${p.name} (id: ${p.id})`).join("\n") ?? ""

    const userPrompt = `Pensamento capturado: "${item.content}"

Projetos ativos do usuário:
${projectList || "(nenhum projeto ativo)"}

Analise e responda em JSON:`

    const raw = await chatCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { format: "json", temperature: 0.2 }
    )

    let llmOutput: z.infer<typeof llmTriageSchema>
    try {
      llmOutput = llmTriageSchema.parse(JSON.parse(raw))
    } catch {
      logger.warn("triageInboxItem", "LLM returned invalid JSON, attempting extraction", { raw: raw.slice(0, 200) })
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("LLM did not return valid JSON")
      llmOutput = llmTriageSchema.parse(JSON.parse(jsonMatch[0]))
    }

    let suggestedProjectId: string | null = null
    let suggestedProjectName: string | null = null
    if (llmOutput.suggested_type && projects) {
      const contentLower = item.content.toLowerCase()
      const match = projects.find((p) => contentLower.includes(p.name.toLowerCase()))
      if (match) {
        suggestedProjectId = match.id
        suggestedProjectName = match.name
      }
    }

    let duplicates: TriageResult["duplicates"] = []
    try {
      const embedding = await embedText(item.content)
      await ensureCollection()
      const results = await searchNotes(user.id, embedding, 3, 0.75)
      if (results.length > 0) {
        const noteIds = results.map((r) => r.id)
        const { data: notes } = await supabase
          .from("note")
          .select("id, title")
          .in("id", noteIds)
          .eq("owner_id", user.id)
        const notesById = new Map(notes?.map((n) => [n.id, n]) ?? [])
        duplicates = results
          .map((r) => {
            const note = notesById.get(r.id)
            if (!note) return null
            return { id: r.id, title: note.title, score: r.score, type: "note" }
          })
          .filter(Boolean) as TriageResult["duplicates"]
      }
    } catch (dupErr) {
      logger.warn("triageInboxItem", "Duplicate detection failed (non-blocking)", { error: (dupErr as Error).message })
    }

    const result: TriageResult = {
      suggested_type: llmOutput.suggested_type,
      suggested_project_id: suggestedProjectId,
      suggested_project_name: suggestedProjectName,
      suggested_priority: llmOutput.suggested_priority,
      suggested_tags: llmOutput.suggested_tags,
      suggested_category: llmOutput.suggested_category,
      action_items: llmOutput.action_items,
      summary: llmOutput.summary || item.content.slice(0, 80),
      duplicates,
    }

    const { error: updateError } = await supabase
      .from("inbox_item")
      .update({ ai_payload: result as unknown as Record<string, unknown> })
      .eq("id", itemId)
      .eq("owner_id", user.id)
    if (updateError) throw updateError

    return { ok: true, result }
  } catch (err) {
    logger.error("triageInboxItem", "Failed", { itemId, error: (err as Error).message })
    return { ok: false, error: (err as Error).message }
  }
}

export async function triageAllPending(): Promise<{ ok: boolean; triaged: number; errors: number }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data: pending, error } = await supabase
      .from("inbox_item")
      .select("id")
      .eq("owner_id", user.id)
      .eq("status", "unprocessed")
      .is("ai_payload", null)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error

    // Lotes de 4 em paralelo em vez de 1-por-1: até 20 chamadas ao LLM em série
    // arriscava estourar o timeout da server action numa única invocação síncrona.
    const BATCH_SIZE = 4
    let triaged = 0
    let errors = 0
    const items = pending ?? []
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(batch.map((item) => triageInboxItem(item.id)))
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.ok) triaged++
        else errors++
      }
    }

    return { ok: true, triaged, errors }
  } catch (err) {
    logger.error("triageAllPending", "Failed", { error: (err as Error).message })
    return { ok: false, triaged: 0, errors: 0 }
  }
}