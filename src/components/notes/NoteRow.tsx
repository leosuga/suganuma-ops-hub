"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useUpdateNote } from "@/lib/queries/notes"
import type { NoteRow as NoteRowType } from "@/lib/queries/notes"
import { useNotes } from "@/lib/queries/notes"
import { useTasks, useCreateTask, useUpdateTask, useTasksByNote } from "@/lib/queries/tasks"
import { useProjects } from "@/lib/queries/projects"
import { parseFrontmatter } from "@/lib/frontmatter"
import { parseWikiLinks, renderWikiLinksToMarkdown } from "@/lib/links"
import { parseInlineTasks, updateInlineTask } from "@/lib/tasks-inline"
import { parseContextTags, CONTEXT_CONFIG } from "@/lib/contexts"
import { cn } from "@/lib/utils"

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false })

const paraColor: Record<string, string> = {
  projects: "text-teal border-teal/30",
  areas: "text-amber border-amber/30",
  resources: "text-teal/60 border-teal/20",
  archive: "text-on-surface/30 border-on-surface/20",
}

const paraLabel: Record<string, string> = {
  projects: "PROJ",
  areas: "AREA",
  resources: "REC",
  archive: "ARQ",
}

interface NoteRowProps {
  note: NoteRowType
  onDelete: (id: string) => void
  allNotes?: NoteRowType[]
  selected?: boolean
  onToggleSelect?: (id: string) => void
  bulkMode?: boolean
}

export function NoteRow({ note, onDelete, allNotes, selected, onToggleSelect, bulkMode }: NoteRowProps) {
  const updateNote = useUpdateNote()
  const { data: tasks = [] } = useTasks()
  const { data: linkedTasks = [] } = useTasksByNote(note.id)
  const { data: projects = [] } = useProjects()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content ?? "")
  const [linkedTaskId, setLinkedTaskId] = useState(note.linked_task_id ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showBacklinks, setShowBacklinks] = useState(false)
  const [showProjectLink, setShowProjectLink] = useState(false)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content ?? "")
    setLinkedTaskId(note.linked_task_id ?? "")
  }, [note])

  const linkedTask = linkedTaskId ? tasks.find(t => t.id === linkedTaskId) : null

  const frontmatter = useMemo(() => parseFrontmatter(note.content ?? ""), [note.content])
  const metadataKeys = Object.keys(frontmatter.metadata)

  const wikiLinks = useMemo(() => parseWikiLinks(note.content ?? ""), [note.content])
  const backlinks = useMemo(() => {
    if (!allNotes) return []
    const normalizedTitle = note.title.toLowerCase().trim()
    return allNotes.filter((n) =>
      n.id !== note.id && (n.content?.toLowerCase().includes(`[[${normalizedTitle}]]`) || n.content?.toLowerCase().includes(`[[${normalizedTitle}|`))
    )
  }, [allNotes, note])

  const markdownBody = useMemo(() => renderWikiLinksToMarkdown(frontmatter.body), [frontmatter.body])
  const inlineTasks = useMemo(() => parseInlineTasks(note.content ?? ""), [note.content])

  const handleInlineToggle = useCallback(async (index: number, checked: boolean) => {
    const updatedContent = updateInlineTask(note.content ?? "", index, checked)
    await updateNote.mutateAsync({ id: note.id, content: updatedContent })
  }, [note.content, note.id, updateNote])

  const handleCreateTaskFromInline = useCallback(async (label: string) => {
    const result = await createTask.mutateAsync({
      title: label,
      category: "personal",
      priority: "med",
      status: "todo",
      linked_note_id: note.id,
    })
    return result
  }, [createTask, note.id])

  const isReviewPending = useMemo(() => {
    if (note.para !== "areas" || note.is_moc) return false
    if (!note.last_review) return true
    const daysSinceReview = (Date.now() - new Date(note.last_review).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceReview > 30
  }, [note])

  async function handleToggleFavorited() {
    await updateNote.mutateAsync({ id: note.id, favorited: !note.favorited })
  }

  async function handleTogglePin() {
    await updateNote.mutateAsync({ id: note.id, pinned: !note.pinned })
  }

  const noteContexts = parseContextTags(note.tags)

  async function handleConvertToTask() {
    const result = await createTask.mutateAsync({
      title: note.title,
      notes: note.content ?? undefined,
      category: "personal",
      priority: "med",
      status: "todo",
      // Herdar contexto da nota como tags da task
      tags: noteContexts.length > 0
        ? noteContexts.map((c) => `ctx/${c}`)
        : note.tags ?? [],
    })
    await updateNote.mutateAsync({ id: note.id, linked_task_id: result.id, pinned: false })
  }

  async function handleSave() {
    if (!title.trim()) return
    const tagsFromContent = content.match(/#[\w-]+/g)?.map((t) => t.slice(1)) ?? (note.tags ?? [])
    await updateNote.mutateAsync({
      id: note.id,
      title: title.trim(),
      content: content.trim() || null,
      tags: tagsFromContent,
      linked_task_id: linkedTaskId || null,
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            Contexto
          </span>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(CONTEXT_CONFIG) as Array<keyof typeof CONTEXT_CONFIG>).map((ctx) => {
              const cfg = CONTEXT_CONFIG[ctx]
              const tag = `ctx/${ctx}`
              const isActive = note.tags?.includes(tag)
              return (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => {
                    const base = note.tags?.filter((t) => !t.startsWith("ctx/")) ?? []
                    const next = isActive ? base : [...base, tag]
                    updateNote.mutateAsync({ id: note.id, tags: next })
                  }}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
                    isActive
                      ? cfg.bg + " " + cfg.color + " border " + cfg.border
                      : "text-on-surface/30 border border-border hover:border-on-surface/30 hover:text-on-surface/50"
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            PARA
          </span>
          <select
            value={note.para ?? ""}
            onChange={(e) => updateNote.mutateAsync({ id: note.id, para: e.target.value as NoteRowType["para"] || null })}
            className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"
          >
            <option value="">Sem categoria</option>
            <option value="projects">Projetos</option>
            <option value="areas">Áreas</option>
            <option value="resources">Recursos</option>
            <option value="archive">Arquivo</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            Vincular a task
          </span>
          <select
            value={linkedTaskId}
            onChange={(e) => setLinkedTaskId(e.target.value)}
            className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"
          >
            <option value="">Nenhuma</option>
            {tasks.filter(t => t.status !== "done" && t.status !== "archived").map((t) => (
              <option key={t.id} value={t.id}>
                {t.title.slice(0, 50)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            Vincular a projeto
          </span>
          <select
            value={note.project_id ?? ""}
            onChange={(e) => updateNote.mutateAsync({ id: note.id, project_id: e.target.value || null })}
            className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"
          >
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
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
      selected && "border-teal/30 bg-teal/5",
      note.pinned && !selected && "border-amber/20",
      noteContexts.length > 0 && !selected && CONTEXT_CONFIG[noteContexts[0]]?.strip,
      noteContexts.length > 0 && "border-l-[3px]"
    )}>
      <div className="flex items-start gap-2">
        {bulkMode && onToggleSelect && (
          <button
            onClick={() => onToggleSelect(note.id)}
            className={cn(
              "flex-none w-4 h-4 rounded-sm border flex items-center justify-center text-[8px] transition-colors mt-0.5",
              selected
                ? "bg-teal/20 border-teal text-teal"
                : "border-on-surface/20 hover:border-teal/60"
            )}
          >
            {selected && "✓"}
          </button>
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !bulkMode && setEditing(true)}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-mono font-semibold text-on-surface truncate">{note.title}</h3>
            {note.pinned && (
              <span className="flex-none text-[8px] font-mono text-amber uppercase tracking-wider">PIN</span>
            )}
            {noteContexts.map((ctx) => {
              const cfg = CONTEXT_CONFIG[ctx]
              if (!cfg) return null
              return (
                <span
                  key={ctx}
                  className={cn(
                    "flex-none text-[7px] font-mono font-semibold uppercase tracking-wider border rounded-sm px-1 py-0",
                    cfg.color,
                    cfg.border,
                    cfg.bg
                  )}
                >
                  {cfg.label}
                </span>
              )
            })}
            {note.para && (
              <span className={cn("flex-none text-[7px] font-mono font-semibold uppercase tracking-wider border rounded-sm px-1 py-0", paraColor[note.para])}>
                {paraLabel[note.para]}
              </span>
            )}
            {note.is_moc && (
              <span className="flex-none text-[7px] font-mono font-semibold text-teal uppercase tracking-wider border border-teal/30 rounded-sm px-1 py-0">
                MOC
              </span>
            )}
            {note.para === "areas" && isReviewPending && (
              <span className="flex-none text-[7px] font-mono font-semibold text-amber uppercase tracking-wider border border-amber/30 rounded-sm px-1 py-0" title="Revisão pendente">
                ⚠ REV
              </span>
            )}
            {metadataKeys.length > 0 && (
              <>
                {metadataKeys.slice(0, 2).map((k) => (
                  <span key={k} className="flex-none text-[7px] font-mono text-on-surface/30 border border-border rounded-sm px-1 py-0">
                    {k}:{frontmatter.metadata[k]}
                  </span>
                ))}
              </>
            )}
          </div>
          {note.content && (
            <div className={cn(
              "prose prose-invert max-w-none text-[11px] font-mono text-on-surface/40 mt-1",
              expanded ? "" : "line-clamp-2"
            )}>
              <ReactMarkdown>{markdownBody}</ReactMarkdown>
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

          {/* Inline tasks — rendered when note has linked tasks or inline task syntax */}
          {(linkedTasks.length > 0 || inlineTasks.length > 0) && (
            <div className="mt-2 space-y-1">
              {inlineTasks.length > 0 && (
                <div className="space-y-1">
                  {inlineTasks.map((task, idx) => {
                    const linked = linkedTasks.find((lt) => lt.title === task.label)
                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (linked) {
                              await updateTask.mutateAsync({
                                id: linked.id,
                                status: linked.status === "done" ? "todo" : "done",
                                completed_at: linked.status === "done" ? null : new Date().toISOString(),
                              })
                            }
                            await handleInlineToggle(task.index, !task.checked)
                          }}
                          className={cn(
                            "w-3.5 h-3.5 border rounded-sm flex items-center justify-center text-[8px] transition-colors",
                            task.checked
                              ? "bg-teal/20 border-teal text-teal"
                              : "border-on-surface/20 hover:border-teal/60"
                          )}
                        >
                          {task.checked ? "✓" : ""}
                        </button>
                        <span className={cn("text-[11px] font-mono", task.checked ? "text-on-surface/30 line-through" : "text-on-surface/60")}>
                          {task.label}
                        </span>
                        {linked && (
                          <span className={cn("text-[8px] font-mono px-1 rounded-sm", linked.status === "done" ? "text-teal bg-teal/10" : "text-amber bg-amber/10")}>
                            {linked.status === "done" ? "done" : linked.status}
                          </span>
                        )}
                        {!linked && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              await handleCreateTaskFromInline(task.label)
                            }}
                            className="text-[8px] font-mono text-on-surface/20 hover:text-teal transition-colors"
                          >
                            +task
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className="mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowBacklinks(!showBacklinks) }}
                className="text-[9px] font-mono text-on-surface/30 hover:text-teal transition-colors"
              >
                🔗 {backlinks.length} {backlinks.length === 1 ? "backlink" : "backlinks"}
              </button>
              {showBacklinks && (
                <div className="mt-1 space-y-1 pl-2 border-l border-border">
                  {backlinks.map((bl) => (
                    <Link
                      key={bl.id}
                      href={`/notes?search=${encodeURIComponent(bl.title)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block text-[11px] font-mono text-on-surface/50 hover:text-teal truncate"
                    >
                      ← {bl.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-none">
          {linkedTask ? (
            <Link
              href={`/tasks?project=${linkedTask.project_id ?? ""}`}
              onClick={(e) => e.stopPropagation()}
              title={`Task: ${linkedTask.title}`}
              className="flex-none text-[8px] font-mono text-teal/60 hover:text-teal border border-teal/30 rounded-sm px-1.5 py-0.5 no-underline"
            >
              TASK ↗
            </Link>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleConvertToTask() }}
              disabled={createTask.isPending}
              className="flex-none text-[7px] font-mono text-on-surface/30 hover:text-teal border border-on-surface/20 hover:border-teal rounded-sm px-1 py-0.5 transition-colors"
              title="Converter em task"
            >
              →TASK
            </button>
          )}
          <button onClick={handleToggleFavorited} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-danger transition-colors text-[11px]" title={note.favorited ? "Desfavoritar" : "Favoritar"}>
            {note.favorited ? "♥" : "♡"}
          </button>
          <button onClick={handleTogglePin} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-amber transition-colors text-[11px]" title={note.pinned ? "Desafixar" : "Fixar"}>
            {note.pinned ? "★" : "☆"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowProjectLink(!showProjectLink) }}
            className={cn(
              "flex-none text-[7px] font-mono border rounded-sm px-1 py-0.5 transition-colors",
              note.project_id
                ? "text-teal/60 border-teal/30 hover:text-teal"
                : "text-on-surface/30 hover:text-teal border-on-surface/20 hover:border-teal"
            )}
            title={note.project_id ? "Trocar projeto" : "Vincular a projeto"}
          >
            {note.project_id ? "PROJ ↗" : "+PROJ"}
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
      {showProjectLink && (
        <div className="mt-2">
          <select
            value={note.project_id ?? ""}
            onChange={(e) => {
              updateNote.mutateAsync({ id: note.id, project_id: e.target.value || null })
              setShowProjectLink(false)
            }}
            className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[11px] font-mono text-on-surface focus:border-teal/40 focus:outline-none"
          >
            <option value="">Nenhum projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="text-[9px] font-mono text-on-surface/20 mt-2">{dateStr}</div>
    </div>
  )
}
