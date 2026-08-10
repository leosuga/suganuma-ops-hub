"use client"

import { useState } from "react"
import { useSemanticSearch } from "@/lib/queries/semantic-search"
import type { NoteRow } from "@/lib/types"

interface SemanticSearchPanelProps {
  onSelectNote: (note: NoteRow) => void
}

export function SemanticSearchPanel({ onSelectNote }: SemanticSearchPanelProps) {
  const { query, setQuery, results, isLoading, search } = useSemanticSearch()
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setHasSearched(true)
    await search()
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          BUSCA SEMÂNTICA
        </span>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pergunte em linguagem natural..."
          className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none"
        >
          {isLoading ? "..." : "BUSCAR"}
        </button>
      </form>

      {hasSearched && results.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          <span className="text-[9px] font-mono text-on-surface/30">
            {results.length} resultado{results.length !== 1 ? "s" : ""} híbrido{results.length !== 1 ? "s" : ""}
          </span>
          {results.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note)}
              className="w-full text-left border border-border rounded-sm p-2 hover:border-teal/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold text-on-surface truncate">
                  {note.title}
                </span>
                {"score" in note && (
                  <span className="flex-none text-[8px] font-mono text-teal/60">
                    {(note.score as number).toFixed(2)}
                  </span>
                )}
                {"source" in note && (
                  <span className="flex-none text-[7px] font-mono text-on-surface/30 border border-on-surface/10 rounded-sm px-1 py-0.5">
                    {(note.source as string).toUpperCase()}
                  </span>
                )}
              </div>
              {note.content && (
                <p className="text-[10px] font-mono text-on-surface/40 mt-0.5 line-clamp-2">
                  {(note.content || "").slice(0, 120)}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {hasSearched && !isLoading && results.length === 0 && (
        <div className="px-4 pb-3">
          <p className="text-[11px] font-mono text-on-surface/30">Nenhuma nota similar encontrada</p>
        </div>
      )}
    </div>
  )
}
