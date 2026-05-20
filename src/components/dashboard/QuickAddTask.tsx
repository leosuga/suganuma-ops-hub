"use client"

import { useState } from "react"
import Link from "next/link"
import { useCreateTask } from "@/lib/queries/tasks"
import { useProjects } from "@/lib/queries/projects"
import { parseTitle } from "@/lib/parse-title"

export function QuickAddTask() {
  const [input, setInput] = useState("")
  const createTask = useCreateTask()
  const { data: projects = [] } = useProjects()

  const parsed = parseTitle(input, projects)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.title.trim()) return

    await createTask.mutateAsync({
      title: parsed.title,
      category: parsed.category ?? "personal",
      priority: parsed.priority ?? "med",
      status: "todo",
      due_at: parsed.due_at ?? null,
      project_id: parsed.project_id ?? null,
      delegated_to: parsed.delegated_to ?? undefined,
      important: parsed.important ?? false,
      recurrence: parsed.recurrence ?? null,
      tags: parsed.tags ?? null,
    })
    setInput("")
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          QUICK-ADD
        </span>
        <Link href="/tasks" className="ml-auto text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">
          +DETALHES →
        </Link>
      </div>
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nova task rápida... (>projeto #finance !urgent ^tomorrow @Fulano +importante)"
          className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
        <button
          type="submit"
          disabled={!parsed.title.trim() || createTask.isPending}
          className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none"
        >
          {createTask.isPending ? "..." : "+ ADD"}
        </button>
      </div>
    </form>
  )
}
