"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { personRelationSchema } from "@/lib/schemas/people"
import type { PersonRelation } from "@/lib/schemas/people"
import type { PersonRow, RelationKind } from "@/lib/types"
import { KIND_LABEL } from "@/lib/people/labels"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: PersonRow[]
  anchorPersonId: string
  onSubmit: (values: PersonRelation) => void
}

export function RelationFormDialog({
  open,
  onOpenChange,
  people,
  anchorPersonId,
  onSubmit,
}: Props) {
  const [toPerson, setToPerson] = useState("")
  const [kind, setKind] = useState<RelationKind>("amigo_de")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setToPerson("")
      setKind("amigo_de")
      setError(null)
    }
  }, [open])

  function handleSubmit() {
    const parsed = personRelationSchema.safeParse({
      from_person: anchorPersonId,
      to_person: toPerson,
      kind,
      note: null,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos")
      return
    }
    onSubmit(parsed.data)
    onOpenChange(false)
  }

  const field = "w-full border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
  const label = "mb-1 block font-mono text-[10px] text-on-surface/60"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-on-surface/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs tracking-wider text-on-surface">
            NOVA RELAÇÃO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="rf-kind">TIPO</label>
            <select
              id="rf-kind"
              className={field}
              value={kind}
              onChange={(e) => setKind(e.target.value as RelationKind)}
            >
              {(Object.keys(KIND_LABEL) as RelationKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="rf-to">PESSOA</label>
            <select
              id="rf-to"
              className={field}
              value={toPerson}
              onChange={(e) => setToPerson(e.target.value)}
            >
              <option value="">Escolha...</option>
              {people
                .filter((p) => p.id !== anchorPersonId)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {error ? <p className="font-mono text-[11px] text-danger">{error}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 font-mono text-[11px] text-on-surface/60 hover:text-on-surface"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
          >
            SALVAR
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
