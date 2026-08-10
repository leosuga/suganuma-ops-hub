"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useTitle } from "@/lib/useTitle"
import { useInbox, useCreateInboxItem, useTriageInboxItem, useArchiveInboxItem, useDeleteInboxItem, useTriageWithAI, useTriageAllPending } from "@/lib/queries/inbox"
import { useCreateTask } from "@/lib/queries/tasks"
import { useCreateNote } from "@/lib/queries/notes"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { cn } from "@/lib/utils"
import type { InboxItemRow } from "@/lib/types"

type StatusFilter = "unprocessed" | "archived" | "all"

const SOURCE_LABELS: Record<string, string> = {
  manual: "MANUAL",
  mcp: "MCP",
  telegram: "TG",
  audio: "AUDIO",
  email: "EMAIL",
  webhook: "HOOK",
}

const TYPE_LABELS: Record<string, string> = {
  task: "TASK",
  note: "NOTE",
  idea: "IDEIA",
  reminder: "LEMBRETE",
  multiple: "MULTIPLO",
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-danger border-danger/40 bg-danger/10",
  high: "text-amber border-amber/40 bg-amber/10",
  med: "text-on-surface/40 border-border bg-transparent",
  low: "text-on-surface/20 border-border/50 bg-transparent",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

interface AiPayload {
  suggested_type?: string
  suggested_priority?: string
  suggested_tags?: string[]
  suggested_category?: string | null
  suggested_project_name?: string | null
  action_items?: string[]
  summary?: string
  duplicates?: Array<{ id: string; title: string; score: number; type: string }>
}

function InboxPageInner() {
  useTitle("Inbox · Suganuma Ops Hub")
  const [filter, setFilter] = useState<StatusFilter>("unprocessed")
  const [input, setInput] = useState("")
  const [converting, setConverting] = useState<string | null>(null)
  const [triaging, setTriaging] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const { data: items = [], isLoading } = useInbox(filter)
  const createInboxItem = useCreateInboxItem()
  const triageInboxItem = useTriageInboxItem()
  const archiveInboxItem = useArchiveInboxItem()
  const deleteInboxItem = useDeleteInboxItem()
  const triageWithAI = useTriageWithAI()
  const triageAll = useTriageAllPending()
  const createTask = useCreateTask()
  const createNote = useCreateNote()

  const unprocessed = items.filter((i) => i.status === "unprocessed")

  useEffect(() => {
    if (selectedIndex >= unprocessed.length) setSelectedIndex(0)
  }, [unprocessed.length, selectedIndex])

  const handleCapture = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    await createInboxItem.mutateAsync({ content: input.trim() })
    setInput("")
  }, [input, createInboxItem])

  const handleConvertToTask = useCallback(async (item: InboxItemRow) => {
    setConverting(item.id)
    try {
      const ai = item.ai_payload as AiPayload | null
      await createTask.mutateAsync({
        title: (ai?.action_items?.[0] ?? item.content).slice(0, 200),
        category: (ai?.suggested_category as "finance" | "logistics" | "personal" | "health") ?? "personal",
        priority: (ai?.suggested_priority as "low" | "med" | "high" | "urgent") ?? "med",
        status: "todo",
        tags: ai?.suggested_tags ?? null,
      })
      await triageInboxItem.mutateAsync(item.id)
    } finally {
      setConverting(null)
    }
  }, [createTask, triageInboxItem])

  const handleConvertToNote = useCallback(async (item: InboxItemRow) => {
    setConverting(item.id)
    try {
      const ai = item.ai_payload as AiPayload | null
      await createNote.mutateAsync({
        title: (ai?.summary ?? item.content).slice(0, 100),
        content: item.content,
        pinned: false,
        tags: ai?.suggested_tags ?? undefined,
      })
      await triageInboxItem.mutateAsync(item.id)
    } finally {
      setConverting(null)
    }
  }, [createNote, triageInboxItem])

  const handleArchive = useCallback(async (id: string) => {
    await archiveInboxItem.mutateAsync(id)
  }, [archiveInboxItem])

  const handleDelete = useCallback(async (id: string) => {
    await deleteInboxItem.mutateAsync(id)
  }, [deleteInboxItem])

  const handleAITriage = useCallback(async (item: InboxItemRow) => {
    setTriaging(item.id)
    try {
      await triageWithAI.mutateAsync(item.id)
    } finally {
      setTriaging(null)
    }
  }, [triageWithAI])

  const handleTriageAll = useCallback(async () => {
    await triageAll.mutateAsync()
  }, [triageAll])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return
      if (filter !== "unprocessed" || unprocessed.length === 0) return

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, unprocessed.length - 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault()
        const item = unprocessed[selectedIndex]
        if (item) handleConvertToTask(item)
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        const item = unprocessed[selectedIndex]
        if (item) handleConvertToNote(item)
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault()
        const item = unprocessed[selectedIndex]
        if (item) handleArchive(item.id)
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault()
        const item = unprocessed[selectedIndex]
        if (item) handleAITriage(item)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [filter, unprocessed, selectedIndex, handleConvertToTask, handleConvertToNote, handleArchive, handleAITriage])

  const counts = {
    unprocessed: items.filter((i) => i.status === "unprocessed").length,
    archived: items.filter((i) => i.status === "archived").length,
    all: items.length,
  }

  const pendingWithoutAI = unprocessed.filter((i) => !i.ai_payload).length

  return (
    <SectionErrorBoundary label="INBOX">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/40 uppercase">
              INBOX
            </span>
            {counts.unprocessed > 0 && (
              <span className="text-[10px] font-mono text-amber">{counts.unprocessed} pendentes</span>
            )}
          </div>
          {pendingWithoutAI > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-on-surface/20">
                {pendingWithoutAI} sem triagem IA
              </span>
              <button
                onClick={handleTriageAll}
                disabled={triageAll.isPending}
                className="h-6 px-2 bg-purple-400/10 border border-purple-400/40 text-purple-400 font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-purple-400/20 disabled:opacity-30 transition-colors"
              >
                {triageAll.isPending ? "TRIANDO..." : "TRIAR TUDO"}
              </button>
            </div>
          )}
        </div>

        {/* Omni-Capture Bar */}
        <div className="px-4 py-3 border-b border-border flex-none">
          <form onSubmit={handleCapture} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Jogue aqui qualquer pensamento, ideia ou lembrete..."
              autoFocus
              className="flex-1 h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || createInboxItem.isPending}
              className="h-9 px-4 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none"
            >
              {createInboxItem.isPending ? "..." : "CAPTURAR"}
            </button>
          </form>
        </div>

        {/* Filter tabs */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-3 flex-none">
          {(["unprocessed", "archived", "all"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "text-[9px] font-mono font-semibold tracking-wider uppercase transition-colors",
                filter === f ? "text-teal" : "text-on-surface/30 hover:text-on-surface/50"
              )}
            >
              {f === "unprocessed" ? "PENDENTES" : f === "archived" ? "ARQUIVADOS" : "TODOS"}
              {counts[f] > 0 && ` (${counts[f]})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto" ref={listRef}>
          {isLoading && (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 border border-border bg-surface rounded-sm animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 p-4">
              <span className="text-[11px] font-mono text-on-surface/20">
                {filter === "unprocessed" ? "Inbox zero. Capture acima." : "Nenhum item."}
              </span>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div className="divide-y divide-border">
              {items.map((item, idx) => {
                const ai = item.ai_payload as AiPayload | null
                const isUnprocessed = item.status === "unprocessed"
                const isSelected = isUnprocessed && idx === selectedIndex

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "px-4 py-3 transition-colors",
                      isSelected && "bg-teal/[0.04]",
                      !isSelected && "hover:bg-surface-hover",
                      item.status === "archived" && "opacity-40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-mono text-on-surface whitespace-pre-wrap break-words">
                          {item.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[8px] font-mono text-on-surface/20">{timeAgo(item.created_at)}</span>
                          <span className="text-[7px] font-mono text-on-surface/30 border border-on-surface/10 rounded-sm px-1 py-0.5">
                            {SOURCE_LABELS[item.source] ?? item.source.toUpperCase()}
                          </span>
                          {item.status === "triaged" && (
                            <span className="text-[7px] font-mono text-teal">TRIAGED</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Suggestions */}
                    {ai && isUnprocessed && (
                      <div className="mt-2 pl-3 border-l-2 border-teal/30 space-y-1.5">
                        {ai.summary && (
                          <p className="text-[10px] font-mono text-on-surface/50 italic">{ai.summary}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ai.suggested_type && (
                            <span className="text-[7px] font-mono font-semibold text-teal border border-teal/30 rounded-sm px-1.5 py-0.5">
                              {TYPE_LABELS[ai.suggested_type] ?? ai.suggested_type.toUpperCase()}
                            </span>
                          )}
                          {ai.suggested_priority && (
                            <span className={cn(
                              "text-[7px] font-mono font-semibold tracking-wider uppercase border rounded-sm px-1.5 py-0.5",
                              PRIORITY_COLORS[ai.suggested_priority] ?? PRIORITY_COLORS.med
                            )}>
                              {ai.suggested_priority.toUpperCase()}
                            </span>
                          )}
                          {ai.suggested_category && (
                            <span className="text-[7px] font-mono text-on-surface/40 border border-on-surface/10 rounded-sm px-1.5 py-0.5">
                              {ai.suggested_category.toUpperCase()}
                            </span>
                          )}
                          {ai.suggested_project_name && (
                            <span className="text-[7px] font-mono text-teal/60">
                              {ai.suggested_project_name}
                            </span>
                          )}
                          {ai.suggested_tags?.map((tag) => (
                            <span key={tag} className="text-[7px] font-mono text-teal/60 border border-teal/20 rounded-sm px-1 py-0.5">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        {ai.action_items && ai.action_items.length > 0 && (
                          <div className="space-y-0.5">
                            {ai.action_items.map((action, i) => (
                              <p key={i} className="text-[10px] font-mono text-on-surface/40">
                                {ai.action_items!.length > 1 ? `${i + 1}. ` : ""}
                                {action}
                              </p>
                            ))}
                          </div>
                        )}
                        {ai.duplicates && ai.duplicates.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[7px] font-mono text-amber">
                              Possível duplicata: {ai.duplicates.map((d) => d.title).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {isUnprocessed && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => handleConvertToTask(item)}
                          disabled={converting === item.id}
                          className="h-6 px-2 bg-teal/10 border border-teal/40 text-teal font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                        >
                          {converting === item.id ? "..." : "TASK"}
                        </button>
                        <button
                          onClick={() => handleConvertToNote(item)}
                          disabled={converting === item.id}
                          className="h-6 px-2 bg-amber/10 border border-amber/40 text-amber font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-amber/20 disabled:opacity-30 transition-colors"
                        >
                          {converting === item.id ? "..." : "NOTE"}
                        </button>
                        {!ai && (
                          <button
                            onClick={() => handleAITriage(item)}
                            disabled={triaging === item.id}
                            className="h-6 px-2 bg-purple-400/10 border border-purple-400/40 text-purple-400 font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-purple-400/20 disabled:opacity-30 transition-colors"
                          >
                            {triaging === item.id ? "..." : "IA"}
                          </button>
                        )}
                        <button
                          onClick={() => handleArchive(item.id)}
                          className="h-6 px-2 bg-on-surface/5 border border-border text-on-surface/40 font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-on-surface/10 transition-colors"
                        >
                          ARQ
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="h-6 px-2 text-on-surface/20 hover:text-danger font-mono text-[8px] tracking-wider transition-colors"
                        >
                          DEL
                        </button>
                      </div>
                    )}

                    {item.status === "archived" && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="h-6 px-2 text-on-surface/20 hover:text-danger font-mono text-[8px] tracking-wider transition-colors"
                        >
                          DEL
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Keyboard hints */}
        {filter === "unprocessed" && unprocessed.length > 0 && (
          <div className="px-4 py-1.5 border-t border-border flex items-center gap-3 flex-none">
            <span className="text-[7px] font-mono text-on-surface/20">J/K navegar</span>
            <span className="text-[7px] font-mono text-on-surface/20">T task</span>
            <span className="text-[7px] font-mono text-on-surface/20">N note</span>
            <span className="text-[7px] font-mono text-on-surface/20">I triar IA</span>
            <span className="text-[7px] font-mono text-on-surface/20">A arquivar</span>
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}

export default function InboxPage() {
  return <InboxPageInner />
}