"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/lib/queries/notes"
import type { NoteRow } from "@/lib/queries/notes"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false })

function NoteRow({ note, onDelete }: { note: NoteRow; onDelete: (id: string) => void }) {
  const updateNote = useUpdateNote()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content ?? "")
  }, [note])

  async function handleTogglePin() {
    await updateNote.mutateAsync({ id: note.id, pinned: !note.pinned })
  }

  async function handleSave() {
    if (!title.trim()) return
    const tagsFromContent = content.match(/#[\w-]+/g)?.map((t) => t.slice(1)) ?? (note.tags ?? [])
    await updateNote.mutateAsync({
      id: note.id,
      title: title.trim(),
      content: content.trim() || null,
      tags: tagsFromContent,
    })
    setEditing(false)
  }

  const dateStr = new Date(note.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })

  if (editing) {
    return (
      <div className="border border-teal/20 bg-surface rounded-sm p-3 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSave() }}
          placeholder="Título"
          autoFocus
          className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono font-semibold text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva sua nota..."
          rows={6}
          className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors resize-none"
        />
        {note.tags && note.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {note.tags.map((t) => (
              <span key={t} className="text-[9px] font-mono text-on-surface/30 px-1.5 py-0.5 border border-border rounded-sm">{t}</span>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="h-7 px-3 text-[9px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors">CANCELAR</button>
          <button onClick={handleSave} disabled={updateNote.isPending || !title.trim()} className="h-7 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors">
            {updateNote.isPending ? "..." : "SALVAR"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "border border-border bg-surface rounded-sm p-3 transition-colors",
      note.pinned && "border-amber/20"
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-mono font-semibold text-on-surface truncate">{note.title}</h3>
            {note.pinned && (
              <span className="flex-none text-[8px] font-mono text-amber uppercase tracking-wider">PIN</span>
            )}
          </div>
          {note.content && (
            <div className={cn(
              "prose prose-invert max-w-none text-[11px] font-mono text-on-surface/40 mt-1",
              expanded ? "" : "line-clamp-2"
            )}>
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
          )}
          {note.content && note.content.length > 120 && !expanded && (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(true) }} className="text-[9px] font-mono text-teal/60 hover:text-teal mt-0.5">
              expandir...
            </button>
          )}
          {note.tags && note.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {note.tags.map((t) => (
                <span key={t} className="text-[8px] font-mono text-on-surface/30 px-1.5 py-0.5 border border-border rounded-sm">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-none">
          <button onClick={handleTogglePin} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-amber transition-colors text-[11px]" title={note.pinned ? "Desafixar" : "Fixar"}>
            {note.pinned ? "★" : "☆"}
          </button>
          {confirmDelete ? (
            <>
              <button onClick={() => { onDelete(note.id); setConfirmDelete(false) }} className="text-[8px] font-mono text-danger hover:opacity-70 tracking-wider">DEL</button>
              <button onClick={() => setConfirmDelete(false)} className="text-on-surface/30 hover:text-on-surface/60 text-[14px] ml-1">×</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-danger transition-colors">×</button>
          )}
        </div>
      </div>
      <div className="text-[9px] font-mono text-on-surface/20 mt-2">{dateStr}</div>
    </div>
  )
}

function QuickAddNote({ onCreated }: { onCreated: () => void }) {
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

export default function NotesPage() {
  const { data: notes = [], isLoading } = useNotes()
  const deleteNote = useDeleteNote()
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) {
      if (n.tags) for (const t of n.tags) set.add(t)
    }
    return Array.from(set).sort()
  }, [notes])

  const filtered = notes.filter((n) => {
    if (filterTag && (!n.tags || !n.tags.includes(filterTag))) return false
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      if (!n.title.toLowerCase().includes(q) && !(n.content?.toLowerCase().includes(q))) return false
    }
    return true
  })

  const pinned = filtered.filter((n) => n.pinned)
  const unpinned = filtered.filter((n) => !n.pinned)

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
            {pinned.map((n) => <NoteRow key={n.id} note={n} onDelete={(id) => deleteNote.mutate(id)} />)}
          </div>
        )}

        {!isLoading && unpinned.length > 0 && (
          <div className="space-y-3">
            {pinned.length > 0 && (
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">NOTAS</span>
            )}
            {unpinned.map((n) => <NoteRow key={n.id} note={n} onDelete={(id) => deleteNote.mutate(id)} />)}
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}
