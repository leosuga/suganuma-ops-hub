"use client"

import { useState, useCallback, useMemo, use } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import {
  usePeople,
  useRelations,
  useConflicts,
  useCreateRelation,
  useDeleteRelation,
  useCreateConflict,
  useUpdateConflict,
  useDeleteConflict,
} from "@/lib/queries/people"
import type { PersonConflictRow } from "@/lib/types"
import type { PersonConflict, PersonRelation } from "@/lib/schemas/people"
import { POLICY_LABEL, VETO_LABEL, KIND_LABEL, HANDLING_LABEL } from "@/lib/people/labels"

const ConflictFormDialog = dynamic(
  () => import("@/components/people/ConflictFormDialog").then((m) => ({ default: m.ConflictFormDialog })),
  { ssr: false },
)
const RelationFormDialog = dynamic(
  () => import("@/components/people/RelationFormDialog").then((m) => ({ default: m.RelationFormDialog })),
  { ssr: false },
)

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: people = [], isLoading: peopleLoading, isError: peopleError } = usePeople()
  const { data: relations = [], isError: relationsError } = useRelations()
  const { data: conflicts = [], isError: conflictsError } = useConflicts()
  // Sem isso, uma query falhando derruba `person` para null e a página
  // renderiza "Pessoa não encontrada" — indistinguível de um id inválido.
  const isError = peopleError || relationsError || conflictsError
  const createRelation = useCreateRelation()
  const deleteRelation = useDeleteRelation()
  const createConflict = useCreateConflict()
  const updateConflict = useUpdateConflict()
  const deleteConflict = useDeleteConflict()

  const person = useMemo(() => people.find((p) => p.id === id) ?? null, [people, id])
  useTitle(person ? `${person.name} · Pessoas` : "Pessoa · Suganuma Ops Hub")

  const [conflictOpen, setConflictOpen] = useState(false)
  const [editingConflict, setEditingConflict] = useState<PersonConflictRow | null>(null)
  const [relationOpen, setRelationOpen] = useState(false)
  const [revealedReasons, setRevealedReasons] = useState<Set<string>>(new Set())

  const nameOf = useCallback(
    (pid: string) => people.find((p) => p.id === pid)?.name ?? "(desconhecido)",
    [people],
  )

  const personRelations = useMemo(
    () => relations.filter((r) => r.from_person === id || r.to_person === id),
    [relations, id],
  )

  const personConflicts = useMemo(
    () => conflicts.filter((c) => c.subject_id === id || c.object_id === id),
    [conflicts, id],
  )

  const toggleReason = useCallback((conflictId: string) => {
    setRevealedReasons((prev) => {
      const next = new Set(prev)
      if (next.has(conflictId)) next.delete(conflictId)
      else next.add(conflictId)
      return next
    })
  }, [])

  const handleConflictSubmit = useCallback(
    (values: PersonConflict, conflictId?: string) => {
      if (conflictId) updateConflict.mutate({ ...values, id: conflictId })
      else createConflict.mutate(values)
    },
    [createConflict, updateConflict],
  )

  const handleRelationSubmit = useCallback(
    (values: PersonRelation) => createRelation.mutate(values),
    [createRelation],
  )

  // Relação e conflito são exatamente o dado que este módulo existe para
  // guardar — ninguém reconstrói de memória "quem fica de fora de qual
  // evento". Um clique errado em DEL não pode apagar isso em silêncio.
  const handleDeleteRelation = useCallback(
    (relationId: string, otherPersonId: string) => {
      const confirmed = window.confirm(
        `Apagar a relação com ${nameOf(otherPersonId)}? Não dá para desfazer.`,
      )
      if (!confirmed) return
      deleteRelation.mutate(relationId)
    },
    [deleteRelation, nameOf],
  )

  const handleDeleteConflict = useCallback(
    (conflict: PersonConflictRow) => {
      const confirmed = window.confirm(
        `Apagar o conflito entre ${nameOf(conflict.subject_id)} e ${nameOf(conflict.object_id)}? Não dá para desfazer.`,
      )
      if (!confirmed) return
      deleteConflict.mutate(conflict.id)
    },
    [deleteConflict, nameOf],
  )

  if (peopleLoading) {
    return (
      <SectionErrorBoundary label="PERSON DETAIL">
        <div className="p-3">
          <Link href="/people" className="font-mono text-[10px] text-on-surface/40 hover:text-accent">
            ← PESSOAS
          </Link>
          <div className="mt-3 h-32 animate-pulse bg-on-surface/5" />
        </div>
      </SectionErrorBoundary>
    )
  }

  if (isError) {
    return (
      <SectionErrorBoundary label="PERSON DETAIL">
        <div className="p-4">
          <p className="font-mono text-[11px] text-danger">Erro ao carregar a pessoa.</p>
          <Link href="/people" className="font-mono text-[11px] text-accent">← VOLTAR</Link>
        </div>
      </SectionErrorBoundary>
    )
  }

  if (!person) {
    return (
      <SectionErrorBoundary label="PERSON DETAIL">
        <div className="p-4">
          <p className="font-mono text-[11px] text-on-surface/40">Pessoa não encontrada.</p>
          <Link href="/people" className="font-mono text-[11px] text-accent">← VOLTAR</Link>
        </div>
      </SectionErrorBoundary>
    )
  }

  return (
    <SectionErrorBoundary label="PERSON DETAIL">
      <div className="p-3">
        <Link href="/people" className="font-mono text-[10px] text-on-surface/40 hover:text-accent">
          ← PESSOAS
        </Link>

        <h1 className="mt-2 text-lg text-on-surface">{person.name}</h1>
        <p className="font-mono text-[11px] text-on-surface/40">
          {person.household ?? "sem grupo familiar"}
          {person.phone ? ` · ${person.phone}` : ""}
        </p>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-on-surface/60">RELAÇÕES</h2>
            <button
              type="button"
              onClick={() => setRelationOpen(true)}
              className="font-mono text-[10px] text-accent"
            >
              + RELAÇÃO
            </button>
          </div>
          {personRelations.length === 0 ? (
            <p className="font-mono text-[11px] text-on-surface/40">Nenhuma relação.</p>
          ) : (
            personRelations.map((r) => {
              const otherId = r.from_person === id ? r.to_person : r.from_person
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-2 border-b border-on-surface/10 py-1.5 text-sm text-on-surface"
                >
                  <span className="flex-1">
                    {nameOf(otherId)}
                    <span className="ml-2 font-mono text-[10px] text-on-surface/40">{KIND_LABEL[r.kind]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRelation(r.id, otherId)}
                    className="font-mono text-[10px] text-on-surface/40 hover:text-danger"
                  >
                    DEL
                  </button>
                </div>
              )
            })
          )}
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-on-surface/60">CONFLITOS</h2>
            <button
              type="button"
              onClick={() => {
                setEditingConflict(null)
                setConflictOpen(true)
              }}
              className="font-mono text-[10px] text-accent"
            >
              + CONFLITO
            </button>
          </div>

          {personConflicts.length === 0 ? (
            <p className="font-mono text-[11px] text-on-surface/40">Nenhum conflito registrado.</p>
          ) : (
            personConflicts.map((c) => (
              <div key={c.id} className="border-b border-on-surface/10 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-on-surface">
                    {c.subject_id === id ? "com " : "de "}
                    {nameOf(c.subject_id === id ? c.object_id : c.subject_id)}
                  </span>
                  <span className="rounded bg-on-surface/10 px-1.5 py-0.5 font-mono text-[10px] text-on-surface/60">
                    {POLICY_LABEL[c.invite_policy]}
                  </span>
                  {c.status === "resolvido" ? (
                    <span className="font-mono text-[10px] text-on-surface/40">RESOLVIDO</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingConflict(c)
                      setConflictOpen(true)
                    }}
                    className="font-mono text-[10px] text-on-surface/60 hover:text-on-surface"
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConflict(c)}
                    className="font-mono text-[10px] text-on-surface/40 hover:text-danger"
                  >
                    DEL
                  </button>
                </div>

                <div className="mt-1 font-mono text-[10px] text-on-surface/40">
                  {VETO_LABEL[c.veto_owner]}
                  {c.excluded_person_id ? ` · fica de fora: ${nameOf(c.excluded_person_id)}` : ""}
                  {c.handling.length > 0
                    ? ` · ${c.handling.map((h) => HANDLING_LABEL[h]).join(", ")}`
                    : ""}
                </div>

                {c.reason ? (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => toggleReason(c.id)}
                      className="font-mono text-[10px] text-on-surface/40 hover:text-on-surface"
                    >
                      {revealedReasons.has(c.id) ? "OCULTAR MOTIVO" : "VER MOTIVO"}
                    </button>
                    {revealedReasons.has(c.id) ? (
                      <p className="mt-1 text-[13px] text-on-surface/80">{c.reason}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>

        {conflictOpen ? (
          <ConflictFormDialog
            open={conflictOpen}
            onOpenChange={setConflictOpen}
            people={people}
            anchorPersonId={id}
            conflict={editingConflict}
            onSubmit={handleConflictSubmit}
          />
        ) : null}

        {relationOpen ? (
          <RelationFormDialog
            open={relationOpen}
            onOpenChange={setRelationOpen}
            people={people}
            anchorPersonId={id}
            onSubmit={handleRelationSubmit}
          />
        ) : null}
      </div>
    </SectionErrorBoundary>
  )
}
