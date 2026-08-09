"use client"

import { useState, useCallback } from "react"
import { useTitle } from "@/lib/useTitle"
import { useInbox, useCreateInboxItem, useTriageInboxItem, useArchiveInboxItem, useDeleteInboxItem } from "@/lib/queries/inbox"
import { useCreateTask } from "@/lib/queries/tasks"
import { useCreateNote } from "@/lib/queries/notes"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { cn } from "@/lib/utils"

type StatusFilter = "unprocessed" | "archived" | "all"

const SOURCE_LABELS: Record<string, string> = {
  manual: "MANUAL",
  mcp: "MCP",
  telegram: "TG",
  audio: "AUDIO",
  email: "EMAIL",
  webhook: "HOOK",
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

function InboxPageInner() {
  useTitle("Inbox · Suganuma Ops Hub")
  const [filter, setFilter] = useState<StatusFilter>("unprocessed")
  const [input, setInput] = useState("")
  const [converting, setConverting] = useState<string | null>(null)

  const { data: items = [], isLoading } = useInbox(filter)
  const createInboxItem = useCreateInboxItem()
  const triageInboxItem = useTriageInboxItem()
  const archiveInboxItem = useArchiveInboxItem()
  const deleteInboxItem = useDeleteInboxItem()
  const createTask = useCreateTask()
  const createNote = useCreateNote()

  const handleCapture = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    await createInboxItem.mutateAsync({ content: input.trim() })
    setInput("")
  }, [input, createInboxItem])

  const handleConvertToTask = useCallback(async (item: typeof items[0]) => {
    setConverting(item.id)
    try {
      await createTask.mutateAsync({
        title: item.content.slice(0, 200),
        category: "personal",
        priority: "med",
        status: "todo",
      })
      await triageInboxItem.mutateAsync(item.id)
    } finally {
      setConverting(null)
    }
  }, [createTask, triageInboxItem])

  const handleConvertToNote = useCallback(async (item: typeof items[0]) => {
    setConverting(item.id)
    try {
      await createNote.mutateAsync({
        title: item.content.slice(0, 100),
        content: item.content,
        pinned: false,
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

  const counts = {
    unprocessed: items.filter((i) => i.status === "unprocessed").length,
    archived: items.filter((i) => i.status === "archived").length,
    all: items.length,
  }

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
        <div className="flex-1 overflow-auto">
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
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "px-4 py-3 hover:bg-surface-hover transition-colors",
                    item.status === "archived" && "opacity-40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-mono text-on-surface whitespace-pre-wrap break-words">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
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

                  {/* Actions */}
                  {item.status === "unprocessed" && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => handleConvertToTask(item)}
                        disabled={converting === item.id}
                        className="h-6 px-2 bg-teal/10 border border-teal/40 text-teal font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                      >
                        {converting === item.id ? "..." : "→ TASK"}
                      </button>
                      <button
                        onClick={() => handleConvertToNote(item)}
                        disabled={converting === item.id}
                        className="h-6 px-2 bg-amber/10 border border-amber/40 text-amber font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-amber/20 disabled:opacity-30 transition-colors"
                      >
                        {converting === item.id ? "..." : "→ NOTE"}
                      </button>
                      <button
                        onClick={() => handleArchive(item.id)}
                        className="h-6 px-2 bg-on-surface/5 border border-border text-on-surface/40 font-mono text-[8px] font-semibold tracking-wider rounded-sm hover:bg-on-surface/10 transition-colors"
                      >
                        ARQUIVAR
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
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionErrorBoundary>
  )
}

export default function InboxPage() {
  return <InboxPageInner />
}