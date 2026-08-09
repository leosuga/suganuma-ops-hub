"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CONTEXT_CONFIG, parseContextTags } from "@/lib/contexts"
import type { NoteRow } from "@/lib/types"

interface ContextNotesWidgetProps {
  notes: NoteRow[]
}

export function ContextNotesWidget({ notes }: ContextNotesWidgetProps) {
  const { recentByContext, counts } = useMemo(() => {
    const recent: Record<string, NoteRow[]> = {}
    const cnt: Record<string, number> = {}
    for (const note of notes) {
      const ctxs = parseContextTags(note.tags)
      for (const ctx of ctxs) {
        cnt[ctx] = (cnt[ctx] ?? 0) + 1
        if (!recent[ctx]) recent[ctx] = []
        if (recent[ctx].length < 2) {
          recent[ctx].push(note)
        }
      }
    }
    return { recentByContext: recent, counts: cnt }
  }, [notes])

  const activeContexts = Object.keys(recentByContext)
  if (activeContexts.length === 0) return null

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          NOTAS POR CONTEXTO
        </span>
        <Link href="/notes" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
          VER TODAS →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
        {activeContexts.slice(0, 4).map((ctx) => {
          const cfg = CONTEXT_CONFIG[ctx]
          if (!cfg) return null
          const ctxNotes = recentByContext[ctx] || []
          const count = counts[ctx] ?? 0

          return (
            <div key={ctx} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <Link
                  href={`/notes?ctx=${ctx}`}
                  className={cn(
                    "text-[9px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded-sm border transition-colors",
                    cfg.bg,
                    cfg.color,
                    cfg.border
                  )}
                >
                  {cfg.label} ({count})
                </Link>
              </div>
              <div className="space-y-1">
                {ctxNotes.slice(0, 2).map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes?search=${encodeURIComponent(note.title)}`}
                    className="block text-[11px] font-mono text-on-surface/60 hover:text-teal transition-colors truncate"
                  >
                    {note.title}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
