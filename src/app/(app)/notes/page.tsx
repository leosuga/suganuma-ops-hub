"use client"

import { useState, useMemo, useRef, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTitle } from "@/lib/useTitle"
import { useNotes, useDeleteNote, useCreateNote, useUpdateNote } from "@/lib/queries/notes"
import { useTasks } from "@/lib/queries/tasks"
import { parseContextTags, CONTEXT_CONFIG } from "@/lib/contexts"
import { buildBacklinksMap } from "@/lib/links"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"
import { NoteRow } from "@/components/notes/NoteRow"
import { QuickAddNote } from "@/components/notes/QuickAddNote"
import { SemanticSearchPanel } from "@/components/notes/SemanticSearchPanel"
import type { NoteRow as NoteRowType } from "@/lib/types"

function groupTagsByPrefix(tags: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const tag of tags) {
    const slashIdx = tag.indexOf("/")
    const prefix = slashIdx > 0 ? tag.slice(0, slashIdx) : "#"
    const rest = slashIdx > 0 ? tag.slice(slashIdx + 1) : tag
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix)!.push(rest)
  }
  return groups
}

function NotesPageInner() {
  useTitle("Notes · Suganuma Ops Hub")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: notes = [], isLoading } = useNotes()
  const { data: tasks = [] } = useTasks()
  // Construído uma vez para a lista inteira — evita cada NoteRow varrer todas
  // as notas para achar seus próprios backlinks (O(N²) na página).
  const backlinksMap = useMemo(() => buildBacklinksMap(notes), [notes])
  const deleteNote = useDeleteNote()
  const createNote = useCreateNote()
  const toast = useUndoToast()
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [filterPrefix, setFilterPrefix] = useState<string | null>(null)
  const [filterPara, setFilterPara] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showSemanticSearch, setShowSemanticSearch] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const updateNote = useUpdateNote()

  const filterContext = searchParams.get("ctx")

  function setFilterContext(ctx: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (ctx) {
      params.set("ctx", ctx)
      localStorage.setItem("lastNotesContext", ctx)
    } else {
      params.delete("ctx")
      localStorage.removeItem("lastNotesContext")
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  useEffect(() => {
    if (!filterContext) {
      const saved = localStorage.getItem("lastNotesContext")
      if (saved && saved !== filterContext) {
        setFilterContext(saved)
      }
    }
  }, [])

  const handleSelectNote = useCallback((note: NoteRowType) => {
    setShowSemanticSearch(false)
    setSearch(note.title)
  }, [])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) {
      if (n.tags) for (const t of n.tags) set.add(t)
    }
    return Array.from(set).sort()
  }, [notes])

  const tagGroups = useMemo(() => groupTagsByPrefix(allTags), [allTags])
  const tagPrefixes = useMemo(() => Array.from(tagGroups.keys()).sort(), [tagGroups])

  const allPara = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) {
      if (n.para) set.add(n.para)
    }
    return Array.from(set).sort()
  }, [notes])

  const contextCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of notes) {
      const ctxs = parseContextTags(n.tags)
      for (const c of ctxs) {
        counts[c] = (counts[c] || 0) + 1
      }
    }
    return counts
  }, [notes])

  const [showFilters, setShowFilters] = useState(false)

  const filtered = notes.filter((n) => {
    if (filterTag && (!n.tags || !n.tags.includes(filterTag))) return false
    if (filterPrefix && (!n.tags || !n.tags.some((t) => t.startsWith(`${filterPrefix}/`)))) return false
    if (filterContext && (!n.tags || !n.tags.some((t) => t === `ctx/${filterContext}`))) return false
    if (filterPara && n.para !== filterPara) return false
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      if (!n.title.toLowerCase().includes(q) && !(n.content?.toLowerCase().includes(q))) return false
    }
    return true
  })

  const mocs = filtered.filter((n) => n.is_moc)
  const pinned = filtered.filter((n) => n.pinned && !n.is_moc)
  const unpinned = filtered.filter((n) => !n.pinned && !n.is_moc)

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

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkContext = useCallback((ctx: string) => {
    selectedIds.forEach((id) => {
      const note = notes.find((n) => n.id === id)
      if (!note) return
      const base = note.tags?.filter((t) => !t.startsWith("ctx/")) ?? []
      updateNote.mutate({ id, tags: [...base, `ctx/${ctx}`] })
    })
    setSelectedIds(new Set())
  }, [selectedIds, notes, updateNote])

  const handleBulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteNote.mutate(id))
    setSelectedIds(new Set())
  }, [selectedIds, deleteNote])

  const handleBulkPara = useCallback((para: string) => {
    selectedIds.forEach((id) => {
      updateNote.mutate({ id, para: para as NoteRowType["para"] })
    })
    setSelectedIds(new Set())
  }, [selectedIds, updateNote])

  const paraLabel: Record<string, string> = {
    projects: "PROJ",
    areas: "AREA",
    resources: "REC",
    archive: "ARQ",
  }

  const activeFilterCount = [
    filterPara,
    filterPrefix,
    filterTag,
  ].filter(Boolean).length

  return (
    <SectionErrorBoundary label="NOTES">
      <div className="p-4 space-y-3">

        {/* MOBILE compact toolbar */}
        <div className="md:hidden space-y-2">
          {/* Title + icon actions */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">NOTES</h1>
              <p className="text-[10px] font-mono text-on-surface/40 mt-0.5">
                {notes.length} nota{notes.length !== 1 ? "s" : ""} · {mocs.length} MOC{mocs.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Bulk toggle icon */}
              <button
                onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-sm border transition-colors active:scale-95",
                  bulkMode
                    ? "bg-teal/15 text-teal border-teal/40"
                    : "text-on-surface/40 border-border hover:border-on-surface/30 hover:text-on-surface/60"
                )}
                title={bulkMode ? "Fechar seleção" : "Selecionar"}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="5" height="5" rx="1" />
                  <rect x="9" y="2" width="5" height="5" rx="1" />
                  <rect x="2" y="9" width="5" height="5" rx="1" />
                  <rect x="9" y="9" width="5" height="5" rx="1" />
                </svg>
              </button>
              {/* Quick add icon */}
              <QuickAddNote onCreated={() => {}} compact />
              {/* Semantic search icon */}
              <button
                onClick={() => setShowSemanticSearch(!showSemanticSearch)}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-sm border transition-colors active:scale-95",
                  showSemanticSearch
                    ? "bg-teal/15 text-teal border-teal/40"
                    : "text-on-surface/40 border-border hover:border-on-surface/30 hover:text-on-surface/50"
                )}
                title="Busca semântica"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11l3 3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search — always visible */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-teal transition-colors"
          />

          {/* Context bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterContext(null)}
              className={cn(
                "flex-none h-7 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
                filterContext === null
                  ? "bg-teal/15 text-teal border border-teal/40"
                  : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
              )}
            >
              TODOS
            </button>
            {(Object.keys(CONTEXT_CONFIG) as Array<keyof typeof CONTEXT_CONFIG>).map((ctx) => {
              const cfg = CONTEXT_CONFIG[ctx]
              const isActive = filterContext === ctx
              return (
                <button
                  key={ctx}
                  onClick={() => setFilterContext(isActive ? null : ctx)}
                  className={cn(
                    "flex-none h-7 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
                    isActive
                      ? cfg.bg + " " + cfg.color + " border " + cfg.border
                      : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {/* FILTROS toggle (PARA + Tags) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "w-full h-7 flex items-center justify-center gap-1.5 rounded-sm font-mono text-[8px] font-semibold tracking-widest border transition-colors active:scale-95",
              activeFilterCount > 0
                ? "bg-teal/10 text-teal border-teal/30"
                : "text-on-surface/40 border-border hover:border-on-surface/30 hover:text-on-surface/50"
            )}
          >
            <span>FILTROS</span>
            {activeFilterCount > 0 && <span className="text-teal">({activeFilterCount})</span>}
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cn("transition-transform", showFilters ? "rotate-180" : "")}>
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {/* Expandable filter panel */}
          {showFilters && (
            <div className="space-y-2 border border-border rounded-sm p-2 bg-surface/50">
              {allPara.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[7px] font-mono text-on-surface/40 tracking-wider flex-none">PARA</span>
                  <button
                    onClick={() => setFilterPara(null)}
                    className={cn(
                      "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
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
                        "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
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
              {tagPrefixes.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[7px] font-mono text-on-surface/40 tracking-wider flex-none">TAGS</span>
                  <button
                    onClick={() => { setFilterPrefix(null); setFilterTag(null) }}
                    className={cn(
                      "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
                      filterPrefix === null && filterTag === null
                        ? "bg-teal/15 text-teal border border-teal/40"
                        : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                    )}
                  >
                    ALL
                  </button>
                  {tagPrefixes.map((prefix) => {
                    const isActive = filterPrefix === prefix
                    const label = prefix === "#" ? "#geral" : `${prefix}/`
                    return (
                      <button
                        key={prefix}
                        onClick={() => {
                          setFilterPrefix(isActive ? null : prefix)
                          setFilterTag(null)
                        }}
                        className={cn(
                          "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
                          isActive
                            ? "bg-teal/15 text-teal border border-teal/40"
                            : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                  {filterPrefix && tagGroups.get(filterPrefix)?.map((rest) => {
                    const fullTag = `${filterPrefix}/${rest}`
                    const isActive = filterTag === fullTag
                    return (
                      <button
                        key={fullTag}
                        onClick={() => setFilterTag(isActive ? null : fullTag)}
                        className={cn(
                          "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
                          isActive
                            ? "bg-amber/15 text-amber border border-amber/40"
                            : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/50"
                        )}
                      >
                        {rest}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {showSemanticSearch && <SemanticSearchPanel onSelectNote={handleSelectNote} />}
        </div>

        {/* DESKTOP full layout */}
        <div className="hidden md:block space-y-3">
          <div>
            <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">NOTES</h1>
            <p className="text-[10px] font-mono text-on-surface/40 mt-0.5">
              {notes.length} nota{notes.length !== 1 ? "s" : ""} · {mocs.length} MOC{mocs.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
              className={cn(
                "h-6 px-2.5 font-mono text-[9px] font-semibold tracking-widest rounded-sm border transition-colors active:scale-95",
                bulkMode
                  ? "bg-teal/15 text-teal border-teal/40"
                  : "text-on-surface/40 border-border hover:border-on-surface/30 hover:text-on-surface/60"
              )}
            >
              {bulkMode ? "FECHAR SELEÇÃO" : "SELECIONAR"}
            </button>
            {bulkMode && selectedIds.size > 0 && (
              <span className="text-[9px] font-mono text-on-surface/40">{selectedIds.size} selecionada(s)</span>
            )}
          </div>

          <QuickAddNote onCreated={() => {}} />

          <button
            onClick={() => setShowSemanticSearch(!showSemanticSearch)}
            className={cn(
              "h-7 px-3 font-mono text-[9px] font-semibold tracking-widest rounded-sm border transition-colors active:scale-95",
              showSemanticSearch
                ? "bg-teal/15 text-teal border-teal/40"
                : "text-on-surface/40 border-border hover:border-on-surface/30 hover:text-on-surface/50"
            )}
          >
            {showSemanticSearch ? "FECHAR BUSCA SEMÂNTICA" : "BUSCA SEMÂNTICA"}
          </button>

          {showSemanticSearch && <SemanticSearchPanel onSelectNote={handleSelectNote} />}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterContext(null)}
              className={cn(
                "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
                filterContext === null
                  ? "bg-teal/15 text-teal border border-teal/40"
                  : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
              )}
            >
              TODOS ({notes.length})
            </button>
            {(Object.keys(CONTEXT_CONFIG) as Array<keyof typeof CONTEXT_CONFIG>).map((ctx) => {
              const cfg = CONTEXT_CONFIG[ctx]
              const isActive = filterContext === ctx
              return (
                <button
                  key={ctx}
                  onClick={() => setFilterContext(isActive ? null : ctx)}
                  className={cn(
                    "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
                    isActive
                      ? cfg.bg + " " + cfg.color + " border " + cfg.border
                      : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                  )}
                >
                  {cfg.label} ({contextCounts[ctx] || 0})
                </button>
              )
            })}
          </div>

          {allPara.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFilterPara(null)}
                className={cn(
                  "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
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
                    "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
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

          {tagPrefixes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => { setFilterPrefix(null); setFilterTag(null) }}
                className={cn(
                  "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
                  filterPrefix === null && filterTag === null
                    ? "bg-teal/15 text-teal border border-teal/40"
                    : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                )}
              >
                ALL
              </button>
              {tagPrefixes.map((prefix) => {
                const isActive = filterPrefix === prefix
                const label = prefix === "#" ? "#geral" : `${prefix}/`
                return (
                  <button
                    key={prefix}
                    onClick={() => {
                      setFilterPrefix(isActive ? null : prefix)
                      setFilterTag(null)
                    }}
                    className={cn(
                      "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
                      isActive
                        ? "bg-teal/15 text-teal border border-teal/40"
                        : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                    )}
                  >
                    {label}
                  </button>
                )
              })}
              {filterPrefix && tagGroups.get(filterPrefix)?.map((rest) => {
                const fullTag = `${filterPrefix}/${rest}`
                const isActive = filterTag === fullTag
                return (
                  <button
                    key={fullTag}
                    onClick={() => setFilterTag(isActive ? null : fullTag)}
                    className={cn(
                      "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors active:scale-95",
                      isActive
                        ? "bg-amber/15 text-amber border border-amber/40"
                        : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/50"
                    )}
                  >
                    {rest}
                  </button>
                )
              })}
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-teal transition-colors"
          />
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border border-border bg-surface rounded-sm p-3 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="border border-border bg-surface rounded-sm p-8 flex items-center justify-center">
            <span className="text-[11px] font-mono text-on-surface/40">Nenhuma nota ainda</span>
          </div>
        )}

        {/* MOCs first */}
        {!isLoading && mocs.length > 0 && (
          <div className="space-y-3">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-teal uppercase">MAPS OF CONTENT</span>
            {mocs.map((n) => (
              <NoteRow key={n.id} note={n} onDelete={handleDelete} backlinksMap={backlinksMap} tasks={tasks} selected={selectedIds.has(n.id)} onToggleSelect={handleToggleSelect} bulkMode={bulkMode} />
            ))}
          </div>
        )}

        {!isLoading && pinned.length > 0 && (
          <div className="space-y-3">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">FIXADAS</span>
            {pinned.map((n) => (
              <NoteRow key={n.id} note={n} onDelete={handleDelete} backlinksMap={backlinksMap} tasks={tasks} selected={selectedIds.has(n.id)} onToggleSelect={handleToggleSelect} bulkMode={bulkMode} />
            ))}
          </div>
        )}

        {!isLoading && unpinned.length > 0 && (
          <div className="space-y-3">
            {(mocs.length > 0 || pinned.length > 0) && (
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">NOTAS</span>
            )}
            {unpinned.map((n) => (
              <NoteRow key={n.id} note={n} onDelete={handleDelete} backlinksMap={backlinksMap} tasks={tasks} selected={selectedIds.has(n.id)} onToggleSelect={handleToggleSelect} bulkMode={bulkMode} />
            ))}
          </div>
        )}

        {/* Bulk actions bar */}
        {bulkMode && selectedIds.size > 0 && (
          <div className="sticky bottom-20 md:bottom-4 border border-teal/30 bg-surface rounded-sm p-2.5 md:p-3 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-teal uppercase tracking-wider">
                {selectedIds.size} selecionada(s)
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[9px] font-mono text-on-surface/40 hover:text-on-surface/60"
              >
                Limpar
              </button>
            </div>
            <div className="grid grid-cols-3 md:flex md:flex-wrap md:items-center gap-1.5">
              <span className="col-span-3 md:col-span-1 text-[9px] font-mono text-on-surface/40 uppercase tracking-wider">Contexto:</span>
              {(Object.keys(CONTEXT_CONFIG) as Array<keyof typeof CONTEXT_CONFIG>).map((ctx) => (
                <button
                  key={ctx}
                  onClick={() => handleBulkContext(ctx)}
                  className={cn(
                    "h-8 md:h-6 px-1.5 md:px-2 rounded-sm font-mono text-[8px] font-semibold tracking-wider transition-colors",
                    CONTEXT_CONFIG[ctx].bg,
                    CONTEXT_CONFIG[ctx].color,
                    CONTEXT_CONFIG[ctx].border
                  )}
                >
                  {CONTEXT_CONFIG[ctx].label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 md:flex md:flex-wrap md:items-center gap-1.5">
              <span className="col-span-4 md:col-span-1 text-[9px] font-mono text-on-surface/40 uppercase tracking-wider">PARA:</span>
              {["projects", "areas", "resources", "archive"].map((para) => (
                <button
                  key={para}
                  onClick={() => handleBulkPara(para)}
                  className="h-8 md:h-6 px-1.5 md:px-2 rounded-sm font-mono text-[8px] font-semibold tracking-wider transition-colors text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                >
                  {paraLabel[para] || para}
                </button>
              ))}
            </div>
            <button
              onClick={handleBulkDelete}
              className="w-full h-8 md:h-7 bg-danger/10 border border-danger text-danger font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-danger/20 transition-colors"
            >
              Deletar {selectedIds.size} nota(s)
            </button>
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse" />}>
      <NotesPageInner />
    </Suspense>
  )
}
