"use client"

import { useState, useMemo } from "react"
import { useTitle } from "@/lib/useTitle"
import { useNotes, useDeleteNote, useCreateNote } from "@/lib/queries/notes"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"
import { NoteRow } from "@/components/notes/NoteRow"
import { QuickAddNote } from "@/components/notes/QuickAddNote"

export default function NotesPage() {
  useTitle("Notes · Suganuma Ops Hub")
  const { data: notes = [], isLoading } = useNotes()
  const deleteNote = useDeleteNote()
  const createNote = useCreateNote()
  const toast = useUndoToast()
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [filterPara, setFilterPara] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) {
      if (n.tags) for (const t of n.tags) set.add(t)
    }
    return Array.from(set).sort()
  }, [notes])

  const allPara = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) {
      if (n.para) set.add(n.para)
    }
    return Array.from(set).sort()
  }, [notes])

  const filtered = notes.filter((n) => {
    if (filterTag && (!n.tags || !n.tags.includes(filterTag))) return false
    if (filterPara && n.para !== filterPara) return false
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      if (!n.title.toLowerCase().includes(q) && !(n.content?.toLowerCase().includes(q))) return false
    }
    return true
  })

  function handleDelete(id: string) {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    const snap = { ...note }
    deleteNote.mutate(id, {
      onSuccess: () => {
        toast.show({
          label: `"${snap.title.slice(0, 40)}" excluída`,
          onUndo: () => {
            createNote.mutate({
              title: snap.title,
              content: snap.content ?? null,
              tags: snap.tags ?? [],
              pinned: snap.pinned,
            })
          },
        })
      },
    })
  }

  const pinned = filtered.filter((n) => n.pinned)
  const unpinned = filtered.filter((n) => !n.pinned)

  const paraLabel: Record<string, string> = {
    projects: "PROJ",
    areas: "AREA",
    resources: "REC",
    archive: "ARQ",
  }

  return (
    <SectionErrorBoundary label="NOTES">
      <div className="p-4 space-y-5">
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            NOTES
          </h1>
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
            {notes.length} nota{notes.length !== 1 ? "s" : ""}
          </p>
        </div>

        <QuickAddNote onCreated={() => {}} />

        {allPara.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterPara(null)}
              className={cn(
                "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
                filterPara === null
                  ? "bg-teal/15 text-teal border border-teal/40"
                  : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
              )}
            >
              ALL
            </button>
            {allPara.map((para) => (
              <button
                key={para}
                onClick={() => setFilterPara(filterPara === para ? null : para)}
                className={cn(
                  "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
                  filterPara === para
                    ? "bg-teal/15 text-teal border border-teal/40"
                    : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                )}
              >
                {paraLabel[para] || para}
              </button>
            ))}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterTag(null)}
              className={cn(
                "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
                filterTag === null
                  ? "bg-teal/15 text-teal border border-teal/40"
                  : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
              )}
            >
              ALL
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={cn(
                  "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
                  filterTag === tag
                    ? "bg-teal/15 text-teal border border-teal/40"
                    : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {notes.length > 5 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
          />
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border border-border bg-surface rounded-sm p-3 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="border border-border bg-surface rounded-sm p-8 flex items-center justify-center">
            <span className="text-[11px] font-mono text-on-surface/20">Nenhuma nota ainda</span>
          </div>
        )}

        {!isLoading && pinned.length > 0 && (
          <div className="space-y-3">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">FIXADAS</span>
            {pinned.map((n) => <NoteRow key={n.id} note={n} onDelete={handleDelete} allNotes={notes} />)}
          </div>
        )}

        {!isLoading && unpinned.length > 0 && (
          <div className="space-y-3">
            {pinned.length > 0 && (
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">NOTAS</span>
            )}
            {unpinned.map((n) => <NoteRow key={n.id} note={n} onDelete={handleDelete} allNotes={notes} />)}
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}
