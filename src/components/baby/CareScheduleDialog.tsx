"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateProject } from "@/lib/queries/projects"
import { useCreateTasksBulk } from "@/lib/queries/tasks"
import { useUpsertChild, type ChildRow } from "@/lib/queries/baby"
import {
  buildCareSchedule,
  toTaskDraft,
  CARE_GROUPS,
  CARE_GROUP_LABEL,
} from "@/lib/baby/care-schedule"
import { saoPauloDate } from "@/lib/baby/dates"
import { today } from "@/lib/date"
import { cn } from "@/lib/utils"

interface CareScheduleDialogProps {
  child: ChildRow
  open: boolean
  onOpenChange: (open: boolean) => void
}

function fmt(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

export function CareScheduleDialog({ child, open, onOpenChange }: CareScheduleDialogProps) {
  const birthDate = saoPauloDate(child.birth_at)
  const todayStr = today()
  const items = useMemo(() => buildCareSchedule(birthDate, todayStr), [birthDate, todayStr])

  // Itens que já venceram começam marcados como "já feito"; o usuário desmarca
  // o que ainda está pendente. Itens futuros começam como pendentes.
  const [done, setDone] = useState<Set<string>>(() => new Set(items.filter((i) => i.isPast).map((i) => i.key)))
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")

  const createProject = useCreateProject()
  const createTasks = useCreateTasksBulk()
  const upsertChild = useUpsertChild()
  const busy = createProject.isPending || createTasks.isPending || upsertChild.isPending

  function toggle(set: Set<string>, key: string, apply: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    apply(next)
  }

  const included = items.filter((i) => !skipped.has(i.key))

  async function handleCreate() {
    setError("")
    let linked = false
    try {
      const project = await createProject.mutateAsync({
        name: `Bebê — ${child.name}`,
        description: "Cronograma de cuidados: triagens, consultas, vacinas, documentos, mãe e compras",
        color: "#F472B6",
        status: "active",
      })
      // Vincula o projeto à criança ANTES de inserir as tasks: se o insert falhar,
      // o botão de gerar não reaparece e não cria um segundo projeto vazio.
      await upsertChild.mutateAsync({
        id: child.id,
        name: child.name,
        birth_at: child.birth_at,
        project_id: project.id,
      })
      linked = true
      await createTasks.mutateAsync(
        included.map((it) => toTaskDraft(it, { done: done.has(it.key), projectId: project.id })),
      )
      onOpenChange(false)
    } catch {
      if (linked) {
        // Desfaz o vínculo para o botão de gerar voltar; o projeto vazio que
        // sobrou pode ser apagado em /projects.
        await upsertChild
          .mutateAsync({ id: child.id, name: child.name, birth_at: child.birth_at, project_id: null })
          .catch(() => undefined)
      }
      setError("Não foi possível criar as tasks. Tente de novo; se sobrar um projeto vazio, apague-o em Projetos.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-lg p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border flex-none">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            GERAR CRONOGRAMA · {included.length} ITENS
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <p className="px-4 py-3 text-[10px] font-mono text-on-surface/40 leading-snug">
            Ponto de partida a partir do nascimento. Desmarque &quot;incluir&quot; no que não se aplica e
            marque &quot;feito&quot; no que já foi resolvido. As vacinas seguem o calendário particular
            (SBIm); confirme doses e datas com o pediatra.
          </p>
          {CARE_GROUPS.map((group) => {
            const rows = items.filter((i) => i.group === group)
            return (
              <div key={group}>
                <div className="h-8 px-4 flex items-center border-y border-border bg-bg">
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40">
                    {CARE_GROUP_LABEL[group]}
                  </span>
                </div>
                {rows.map((it) => {
                  const off = skipped.has(it.key)
                  return (
                    <div key={it.key} className={cn("flex items-start gap-2 px-4 py-2", off && "opacity-40")}>
                      <span className="text-[10px] font-mono text-on-surface/40 w-11 flex-none pt-0.5">
                        {fmt(it.dueDate)}
                      </span>
                      <span className="flex-1 text-[11px] font-mono text-on-surface leading-snug">{it.title}</span>
                      <label className="flex items-center gap-1 text-[9px] font-mono text-on-surface/60 flex-none min-h-[28px]">
                        <input
                          type="checkbox"
                          checked={!off}
                          onChange={() => toggle(skipped, it.key, setSkipped)}
                        />
                        incluir
                      </label>
                      <label className="flex items-center gap-1 text-[9px] font-mono text-on-surface/60 flex-none min-h-[28px]">
                        <input
                          type="checkbox"
                          checked={done.has(it.key)}
                          disabled={off}
                          onChange={() => toggle(done, it.key, setDone)}
                        />
                        feito
                      </label>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="px-4 py-3 border-t border-border flex-none flex items-center justify-end gap-2">
          {error && <p className="flex-1 text-[10px] font-mono text-danger">{error}</p>}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || included.length === 0}
            className="h-8 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30"
          >
            {busy ? "CRIANDO..." : `CRIAR ${included.length} TASKS →`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
