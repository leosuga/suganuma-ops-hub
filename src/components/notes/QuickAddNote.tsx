"use client"

import { useState } from "react"
import { useCreateNote } from "@/lib/queries/notes"
import { injectFrontmatter } from "@/lib/frontmatter"
import { cn } from "@/lib/utils"

type TemplateKey = "standard" | "moc" | "daily" | "project" | "area" | "resource"

const TEMPLATES: Record<
  TemplateKey,
  { label: string; para: "projects" | "areas" | "resources" | "archive" | null; isMoc: boolean; frontmatter: Record<string, string> }
> = {
  standard: { label: "Padrão", para: null, isMoc: false, frontmatter: {} },
  moc: { label: "MOC (Índice)", para: "projects", isMoc: true, frontmatter: { type: "moc" } },
  daily: { label: "Nota do dia", para: null, isMoc: false, frontmatter: { type: "daily" } },
  project: { label: "Projeto", para: "projects", isMoc: false, frontmatter: { status: "ativo" } },
  area: { label: "Área", para: "areas", isMoc: false, frontmatter: { review: "mensal" } },
  resource: { label: "Recurso", para: "resources", isMoc: false, frontmatter: { source: "" } },
}

export function QuickAddNote({ onCreated }: { onCreated: () => void }) {
  const [input, setInput] = useState("")
  const [template, setTemplate] = useState<TemplateKey>("standard")
  const [showTemplates, setShowTemplates] = useState(false)
  const createNote = useCreateNote()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const t = TEMPLATES[template]
    const content = injectFrontmatter("", t.frontmatter)

    await createNote.mutateAsync({
      title: input.trim(),
      content: content || null,
      tags: [],
      pinned: false,
      para: t.para,
      is_moc: t.isMoc,
      daily_date: template === "daily" ? new Date().toISOString().slice(0, 10) : null,
    })

    setInput("")
    setTemplate("standard")
    setShowTemplates(false)
    onCreated()
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
              onClick={() => setTemplate(k)}
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
