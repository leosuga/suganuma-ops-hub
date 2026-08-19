import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { today as todayInSaoPaulo } from "@/lib/date"

export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const supabase = createServiceClient()
  const today = todayInSaoPaulo()
  const now = new Date().toISOString()

  const [tasksResult, inboxResult, appointmentsResult, eventsResult] = await Promise.all([
    supabase
      .from("task")
      .select("id, title, priority, important, due_at, status, category, project_id")
      .eq("owner_id", ownerId)
      .in("status", ["todo", "doing"])
      .order("priority", { ascending: false })
      .limit(50),
    supabase
      .from("inbox_item")
      .select("id, content, source, created_at")
      .eq("owner_id", ownerId)
      .eq("status", "unprocessed")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("appointment")
      .select("id, title, starts_at, location, kind")
      .eq("owner_id", ownerId)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("annual_event")
      .select("id, title, start_date, end_date, color")
      .eq("owner_id", ownerId)
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .limit(5),
  ])

  if (tasksResult.error) return serverError(tasksResult.error.message)

  const tasks = tasksResult.data ?? []
  const urgentTasks = tasks.filter((t) => t.priority === "urgent" || (t.important && t.due_at && new Date(t.due_at) < new Date()))
  const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "done")
  const quickWins = tasks.filter((t) => t.priority === "low" || t.priority === "med")

  return NextResponse.json({
    date: today,
    inbox_count: (inboxResult.data ?? []).length,
    inbox_items: inboxResult.data ?? [],
    urgent_tasks: urgentTasks.slice(0, 5),
    overdue_count: overdueTasks.length,
    overdue_tasks: overdueTasks.slice(0, 5),
    quick_wins: quickWins.slice(0, 5),
    upcoming_appointments: appointmentsResult.data ?? [],
    upcoming_events: eventsResult.data ?? [],
    total_pending: tasks.length,
  })
}