"use client"

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import {
  usePeople,
  useRelations,
  useConflicts,
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
} from "@/lib/queries/people"
import { PersonRow } from "@/components/people/PersonRow"
import type { PersonRow as PersonRowType } from "@/lib/types"
import type { Person } from "@/lib/schemas/people"

const PersonFormDialog = dynamic(
  () => import("@/components/people/PersonFormDialog").then((m) => ({ default: m.PersonFormDialog })),
  { ssr: false },
)

export default function PeoplePage() {
  useTitle("Pessoas · Suganuma Ops Hub")
  const { data: people = [], isLoading } = usePeople()
  const { data: relations = [] } = useRelations()
  const { data: conflicts = [] } = useConflicts()
  const createPerson = useCreatePerson()
  const updatePerson = useUpdatePerson()
  const deletePerson = useDeletePerson()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PersonRowType | null>(null)
  const [search, setSearch] = useState("")
  const [sideFilter, setSideFilter] = useState<string>("all")

  const conflictCountByPerson = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of conflicts) {
      if (c.status !== "ativo") continue
      counts.set(c.subject_id, (counts.get(c.subject_id) ?? 0) + 1)
      counts.set(c.object_id, (counts.get(c.object_id) ?? 0) + 1)
    }
    return counts
  }, [conflicts])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return people.filter((p) => {
      if (sideFilter !== "all" && p.side !== sideFilter) return false
      if (!term) return true
      return (
        p.name.toLowerCase().includes(term) ||
        (p.nickname ?? "").toLowerCase().includes(term) ||
        (p.household ?? "").toLowerCase().includes(term)
      )
    })
  }, [people, search, sideFilter])

  const handleEdit = useCallback(
    (id: string) => {
      setEditing(people.find((p) => p.id === id) ?? null)
      setFormOpen(true)
    },
    [people],
  )

  const handleDelete = useCallback(
    (id: string) => {
      const person = people.find((p) => p.id === id)
      if (!person) return

      // Excluir uma pessoa apaga em cascata (migration 0040_people.sql) suas
      // relações e conflitos — não há "desfazer" que reconstrua conflitos de
      // memória. Confirmar com os números reais em vez de oferecer undo.
      const relationCount = relations.filter(
        (r) => r.from_person === id || r.to_person === id,
      ).length
      const conflictCount = conflicts.filter(
        (c) => c.subject_id === id || c.object_id === id || c.excluded_person_id === id,
      ).length

      const parts: string[] = []
      if (relationCount > 0) {
        parts.push(relationCount === 1 ? "1 relação" : `${relationCount} relações`)
      }
      if (conflictCount > 0) {
        parts.push(conflictCount === 1 ? "1 conflito" : `${conflictCount} conflitos`)
      }

      const impact = parts.length > 0 ? ` Isso também apaga ${parts.join(" e ")} registrado(s).` : ""
      const confirmed = window.confirm(
        `Apagar "${person.name}"?${impact} Não dá para desfazer.`,
      )
      if (!confirmed) return

      deletePerson.mutate(id)
    },
    [people, relations, conflicts, deletePerson],
  )

  const handleSubmit = useCallback(
    (values: Person, id?: string) => {
      if (id) updatePerson.mutate({ ...values, id })
      else createPerson.mutate(values)
    },
    [createPerson, updatePerson],
  )

  return (
    <SectionErrorBoundary>
      <div className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <input
            className="min-w-0 flex-1 border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
            placeholder="Buscar pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-on-surface/20 bg-surface px-2 py-1.5 font-mono text-[11px] text-on-surface"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
          >
            <option value="all">TODOS</option>
            <option value="leo">MEU</option>
            <option value="parceira">DELA</option>
            <option value="comum">COMUM</option>
            <option value="outro">OUTRO</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="shrink-0 bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
          >
            + PESSOA
          </button>
        </div>

        {isLoading ? <div className="h-32 animate-pulse bg-on-surface/5" /> : null}

        {!isLoading && visible.length === 0 ? (
          <p className="py-8 text-center font-mono text-[11px] text-on-surface/40">
            Nenhuma pessoa encontrada.
          </p>
        ) : null}

        {!isLoading
          ? visible.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                conflictCount={conflictCountByPerson.get(p.id) ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          : null}

        {formOpen ? (
          <PersonFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            person={editing}
            onSubmit={handleSubmit}
          />
        ) : null}
      </div>
    </SectionErrorBoundary>
  )
}
