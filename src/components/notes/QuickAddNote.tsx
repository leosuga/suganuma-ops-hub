"use client"

import { useState } from "react"
import { useCreateNote } from "@/lib/queries/notes"

export function QuickAddNote({ onCreated }: { onCreated: () => void }) {
  const [input, setInput] = useState("")
  const createNote = useCreateNote()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    await createNote.mutateAsync({ title: input.trim(), content: null, tags: [], pinned: false })
    setInput("")
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          NOVA NOTA RÁPIDA
        </span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Título da nota..."
          className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || createNote.isPending}
          className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none"
        >
          {createNote.isPending ? "..." : "+ ADD"}
        </button>
      </div>
    </form>
  )
}
