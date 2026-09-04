"use client"

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { VirtualizedList } from "@/components/VirtualizedList"
import {
  usePeople,
  useRelations,
  useConflicts,
  useGuestEvents,
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
} from "@/lib/queries/people"
import { PersonRow } from "@/components/people/PersonRow"
import type { PersonRow as PersonRowType } from "@/lib/types"
import type { Person } from "@/lib/schemas/people"
import { CIRCLE_LABEL } from "@/lib/people/labels"

const PersonFormDialog = dynamic(
  () => import("@/components/people/PersonFormDialog").then((m) => ({ default: m.PersonFormDialog })),
  { ssr: false },
)

const CIRCLE_OPTIONS = Object.keys(CIRCLE_LABEL) as (keyof typeof CIRCLE_LABEL)[]

export default function PeoplePage() {
  useTitle("Pessoas · Suganuma Ops Hub")
  const { data: people = [], isLoading, isError: peopleError } = usePeople()
  const { data: relations = [], isError: relationsError } = useRelations()
  const { data: conflicts = [], isError: conflictsError } = useConflicts()
  const { data: events = [], isError: eventsError } = useGuestEvents()
  // Qualquer uma das 4 falhando degrada a página em silêncio (contagem de
  // conflitos zerada, eventos sumindo) — tratar como erro, não como vazio.
  const isError = peopleError || relationsError || conflictsError || eventsError
  const createPerson = useCreatePerson()
  const updatePerson = useUpdatePerson()
  const deletePerson = useDeletePerson()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PersonRowType | null>(null)
  const [search, setSearch] = useState("")
  const [sideFilter, setSideFilter] = useState<string>("all")
  const [circleFilter, setCircleFilter] = useState<string>("all")

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
      if (circleFilter !== "all" && p.circle !== circleFilter) return false
      if (!term) return true
      return (
        p.name.toLowerCase().includes(term) ||
        (p.nickname ?? "").toLowerCase().includes(term) ||
        (p.household ?? "").toLowerCase().includes(term)
      )
    })
  }, [people, search, sideFilter, circleFilter])

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

  const renderPersonRow = useCallback(
    (index: number) => {
      const p = visible[index]
      return (
        <PersonRow
          key={p.id}
          person={p}
          conflictCount={conflictCountByPerson.get(p.id) ?? 0}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )
    },
    [visible, conflictCountByPerson, handleEdit, handleDelete],
  )

  // §5 do spec dimensiona o módulo em centenas a milhares de pessoas.
  const useVirtual = visible.length > 50

  return (
    <SectionErrorBoundary label="PEOPLE">
      <div className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <input
            className="min-w-0 flex-1 border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
            placeholder="Buscar pessoa..."
            aria-label="Buscar pessoa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-on-surface/20 bg-surface px-2 py-1.5 font-mono text-[11px] text-on-surface"
            value={sideFilter}
            aria-label="Filtrar por lado"
            onChange={(e) => setSideFilter(e.target.value)}
          >
            <option value="all">TODOS</option>
            <option value="leo">MEU</option>
            <option value="parceira">DELA</option>
            <option value="comum">COMUM</option>
            <option value="outro">OUTRO</option>
          </select>
          <select
            className="border border-on-surface/20 bg-surface px-2 py-1.5 font-mono text-[11px] text-on-surface"
            value={circleFilter}
            aria-label="Filtrar por círculo"
            onChange={(e) => setCircleFilter(e.target.value)}
          >
            <option value="all">TODOS OS CÍRCULOS</option>
            {CIRCLE_OPTIONS.map((c) => (
              <option key={c} value={c}>{CIRCLE_LABEL[c]}</option>
            ))}
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

        {events.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/people/events/${e.id}`}
                className="border border-on-surface/20 px-2 py-1 font-mono text-[10px] text-on-surface/70 hover:border-accent hover:text-accent"
              >
                {e.name.toUpperCase()}
              </Link>
            ))}
          </div>
        ) : null}

        {isLoading ? <div className="h-32 animate-pulse bg-on-surface/5" /> : null}

        {!isLoading && isError ? (
          <p className="py-8 text-center font-mono text-[11px] text-danger">
            Erro ao carregar pessoas.
          </p>
        ) : null}

        {!isLoading && !isError && visible.length === 0 ? (
          <p className="py-8 text-center font-mono text-[11px] text-on-surface/40">
            Nenhuma pessoa encontrada.
          </p>
        ) : null}

        {!isLoading && !isError && visible.length > 0 ? (
          useVirtual ? (
            <VirtualizedList items={visible} rowHeight={56} renderRow={renderPersonRow} />
          ) : (
            visible.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                conflictCount={conflictCountByPerson.get(p.id) ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )
        ) : null}

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
