"use client"

import { useState } from "react"
import { useCreateNote } from "@/lib/queries/notes"
import { useProjects } from "@/lib/queries/projects"
import { injectFrontmatter } from "@/lib/frontmatter"
import { CONTEXT_CONFIG, addContextTag } from "@/lib/contexts"
import { cn } from "@/lib/utils"

type TemplateKey = "standard" | "moc" | "daily" | "project" | "area" | "resource"

type ContextKey = keyof typeof CONTEXT_CONFIG

const TEMPLATES: Record<
  TemplateKey,
  { label: string; para: "projects" | "areas" | "resources" | "archive" | null; isMoc: boolean; frontmatter: Record<string, string>; defaultContext?: ContextKey }
> = {
  standard: { label: "Padrão", para: null, isMoc: false, frontmatter: {} },
  moc: { label: "MOC (Índice)", para: "projects", isMoc: true, frontmatter: { type: "moc" } },
  daily: { label: "Nota do dia", para: null, isMoc: false, frontmatter: { type: "daily" }, defaultContext: "pessoal" },
  project: { label: "Projeto", para: "projects", isMoc: false, frontmatter: { status: "ativo" }, defaultContext: "work" },
  area: { label: "Área", para: "areas", isMoc: false, frontmatter: { review: "mensal" }, defaultContext: "pessoal" },
  resource: { label: "Recurso", para: "resources", isMoc: false, frontmatter: { source: "" }, defaultContext: "estudos" },
}

export function QuickAddNote({ onCreated, compact }: { onCreated: () => void; compact?: boolean }) {
  const [input, setInput] = useState("")
  const [template, setTemplate] = useState<TemplateKey>("standard")
  const [showTemplates, setShowTemplates] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedContext, setSelectedContext] = useState<ContextKey | null>(null)
  const { data: projects = [] } = useProjects()
  const createNote = useCreateNote()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const t = TEMPLATES[template]
    const selectedProject = projects.find((p) => p.id === selectedProjectId)
    const fm = selectedProject
      ? { ...t.frontmatter, projeto: selectedProject.name }
      : t.frontmatter
    const content = injectFrontmatter("", fm)

    let tags: string[] = []
    if (selectedContext) {
      tags = addContextTag(null, selectedContext)
    }
    if (selectedProject) {
      tags = [...tags, `proj/${selectedProject.name.toLowerCase().replace(/\s+/g, "-")}`]
    }

    await createNote.mutateAsync({
      title: input.trim(),
      content: content || null,
      tags,
      pinned: false,
      para: t.para,
      is_moc: t.isMoc,
      daily_date: template === "daily" ? new Date().toISOString().slice(0, 10) : null,
      project_id: selectedProjectId,
    })

    setInput("")
    setTemplate("standard")
    setSelectedProjectId(null)
    setSelectedContext(null)
    setShowTemplates(false)
    setShowForm(false)
    onCreated()
  }

  const showProjectPicker = template === "project" && projects.length > 0

  if (compact) {
    return (
      <>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-on-surface/40 hover:text-on-surface/60 hover:border-on-surface/30 transition-colors active:scale-95"
            title="Nova nota"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v12M2 8h12" />
            </svg>
          </button>
        ) : (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
            <div className="w-full max-w-md border border-border bg-surface rounded-sm shadow-2xl">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-bg">
                <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">NOVA NOTA</span>
                <button onClick={() => setShowForm(false)} className="text-[10px] font-mono text-on-surface/30 hover:text-on-surface/60">FECHAR</button>
              </div>
              <form onSubmit={handleSubmit} className="p-3 space-y-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Título da nota..."
                  autoFocus
                  className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTemplate(k)
                        if (k !== "project") setSelectedProjectId(null)
                      }}
                      className={cn(
                        "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
                        template === k
                          ? "bg-teal/15 text-teal border border-teal/40"
                          : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
                      )}
                    >
                      {TEMPLATES[k].label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(Object.keys(CONTEXT_CONFIG) as ContextKey[]).map((ctx) => {
                    const cfg = CONTEXT_CONFIG[ctx]
                    const isActive = selectedContext === ctx
                    return (
                      <button
                        key={ctx}
                        type="button"
                        onClick={() => setSelectedContext(isActive ? null : ctx)}
                        className={cn(
                          "flex-none h-6 px-2 rounded-sm font-mono text-[8px] font-semibold tracking-widest transition-colors",
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
                {showProjectPicker && (
                  <select
                    value={selectedProjectId ?? ""}
                    onChange={(e) => setSelectedProjectId(e.target.value || null)}
                    className="w-full h-7 px-2 bg-bg border border-border rounded-sm text-[10px] font-mono text-on-surface focus:border-teal/40 focus:outline-none"
                  >
                    <option value="">Projeto (opcional)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || createNote.isPending}
                  className="w-full h-9 bg-teal/10 border border-teal text-teal font-mono text-[11px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                >
                  {createNote.isPending ? "CRIANDO..." : "CRIAR NOTA →"}
                </button>
              </form>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          NOVA NOTA RÁPIDA
        </span>
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className={cn(
            "text-[9px] font-mono font-semibold tracking-wider rounded-sm px-2 h-5 transition-colors",
            showTemplates ? "bg-teal/15 text-teal border border-teal/40" : "text-on-surface/30 hover:text-on-surface/50"
          )}
        >
          {showTemplates ? "FECHAR" : "TEMPLATE"}
        </button>
      </div>

      {showTemplates && (
        <div className="px-4 py-2 border-b border-border bg-bg flex flex-wrap gap-1.5">
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTemplate(k)
                if (k !== "project") setSelectedProjectId(null)
              }}
              className={cn(
                "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
                template === k
                  ? "bg-teal/15 text-teal border border-teal/40"
                  : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
              )}
            >
              {TEMPLATES[k].label}
            </button>
          ))}
        </div>
      )}

      {/* Context selector */}
      {showTemplates && (
        <div className="px-4 py-2 border-b border-border bg-bg flex flex-wrap gap-1.5">
          <span className="w-full text-[8px] font-mono text-on-surface/30 uppercase tracking-wider mb-1">Contexto</span>
          {(Object.keys(CONTEXT_CONFIG) as ContextKey[]).map((ctx) => {
            const cfg = CONTEXT_CONFIG[ctx]
            const isActive = selectedContext === ctx
            return (
              <button
                key={ctx}
                type="button"
                onClick={() => setSelectedContext(isActive ? null : ctx)}
                className={cn(
                  "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
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
      )}

      {showProjectPicker && (
        <div className="px-4 py-2 border-b border-border bg-bg">
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="h-7 px-2 bg-bg border border-border rounded-sm text-[10px] font-mono text-on-surface focus:border-teal/40 focus:outline-none w-full"
          >
            <option value="">Selecionar projeto... (opcional)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status === "active" ? "ativo" : p.status === "paused" ? "pausado" : "concluído"})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={template === "daily" ? `Nota do dia (${new Date().toLocaleDateString("pt-BR")})...` : "Título da nota..."}
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
