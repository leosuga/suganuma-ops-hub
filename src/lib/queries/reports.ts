"use client"

import { createClient } from "@/lib/supabase/client"

export interface ReportData {
  tasks: { id: string; completed_at: string | null; due_at: string | null; created_at: string }[]
  transactions: { id: string; kind: string; amount: number; occurred_on: string }[]
  habits: { id: string; name: string; active: boolean; emoji: string | null; color: string | null }[]
  entries: { habit_id: string; done_on: string }[]
}

export async function fetchReports(): Promise<ReportData> {
  const supabase = createClient()

  const [
    { data: tasks, error: e1 },
    { data: transactions, error: e2 },
    { data: habits, error: e3 },
    { data: entries, error: e4 },
  ] = await Promise.all([
    supabase.from("task").select("id, completed_at, due_at, created_at").neq("status", "archived"),
    supabase.from("transaction").select("id, kind, amount, occurred_on"),
    supabase.from("habit_track").select("id, name, active, emoji, color"),
    supabase.from("habit_entry").select("habit_id, done_on").order("done_on", { ascending: true }).limit(1000),
  ])

  if (e1) throw e1
  if (e2) throw e2
  if (e3) throw e3
  if (e4) throw e4

  return {
    tasks: (tasks ?? []) as ReportData["tasks"],
    transactions: (transactions ?? []) as ReportData["transactions"],
    habits: (habits ?? []) as ReportData["habits"],
    entries: (entries ?? []) as ReportData["entries"],
  }
}
