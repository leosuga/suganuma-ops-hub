import { createServiceClient } from "@/lib/supabase/service"
import { today } from "@/lib/date"
import { ageLabel, summarize24h, type Summary24h } from "./summary"
import type { ChildRow, BabyLogRow } from "@/lib/types/baby"

// Uso exclusivo de rotas de agente (service role, bypassa RLS): todo filtro por
// owner_id aqui é a única barreira entre usuários.

export async function fetchOwnerChild(ownerId: string): Promise<ChildRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("child")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as ChildRow | null
}

export interface BabySnapshot {
  child: { id: string; name: string; birth_at: string; age: string }
  summary: Summary24h
  next_care: Array<{ id: string; title: string; due_at: string | null; priority: string }>
}

/** Estado atual da bebê para agentes: idade, resumo de 24h e próximos cuidados do cronograma. */
export async function buildBabySnapshot(ownerId: string): Promise<BabySnapshot | null> {
  const child = await fetchOwnerChild(ownerId)
  if (!child) return null

  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString()

  const [logsRes, careRes] = await Promise.all([
    supabase
      .from("baby_log")
      .select("kind, started_at, ended_at, data")
      .eq("owner_id", ownerId)
      .eq("child_id", child.id)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(500),
    child.project_id
      ? supabase
          .from("task")
          .select("id, title, due_at, priority")
          .eq("owner_id", ownerId)
          .eq("project_id", child.project_id)
          .in("status", ["todo", "doing"])
          .order("due_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (logsRes.error) throw new Error(logsRes.error.message)
  if (careRes.error) throw new Error(careRes.error.message)

  return {
    child: { id: child.id, name: child.name, birth_at: child.birth_at, age: ageLabel(child.birth_at, today()) },
    summary: summarize24h((logsRes.data ?? []) as Pick<BabyLogRow, "kind" | "started_at" | "ended_at" | "data">[], nowIso),
    next_care: (careRes.data ?? []) as BabySnapshot["next_care"],
  }
}
