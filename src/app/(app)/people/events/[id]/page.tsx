"use client"

import { useCallback, useMemo, use } from "react"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { usePeople, useConflicts, useGuestEvents, useGuestInvites, useUpsertInvite } from "@/lib/queries/people"
import { checkGuestList, ON_LIST_STATUSES } from "@/lib/people/conflicts"
import { ViolationPanel } from "@/components/people/ViolationPanel"
import { InviteRow } from "@/components/people/InviteRow"
import type { InviteStatus } from "@/lib/types"

export default function GuestEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params)
  const { data: people = [], isError: peopleError } = usePeople()
  const { data: conflicts = [], isError: conflictsError } = useConflicts()
  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useGuestEvents()
  const { data: invites = [], isLoading, isError: invitesError } = useGuestInvites(eventId)
  const upsertInvite = useUpsertInvite()
  // `events` falhando derruba `event` para null e a página renderiza "Evento
  // não encontrado" — indistinguível de um id inválido. As outras 3 queries
  // degradam violações/status em silêncio (nenhuma some, mas fica errada).
  const isError = peopleError || conflictsError || eventsError || invitesError

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId])
  useTitle(event ? `${event.name} · Convidados` : "Evento · Suganuma Ops Hub")

  const statusByPerson = useMemo(() => {
    const map = new Map<string, InviteStatus>()
    for (const i of invites) map.set(i.person_id, i.status)
    return map
  }, [invites])

  const violations = useMemo(
    () =>
      checkGuestList(
        invites.map((i) => ({ person_id: i.person_id, status: i.status })),
        conflicts,
        people.map((p) => ({ id: p.id, name: p.name })),
      ),
    [invites, conflicts, people],
  )

  const blockedPeople = useMemo(() => {
    const ids = new Set<string>()
    for (const v of violations) {
      if (v.level !== "block") continue
      if (v.excludedId) {
        // excluir_um: a decisão já foi tomada — só a pessoa excluída é o
        // problema, a outra ponta do conflito está liberada.
        ids.add(v.excludedId)
      } else {
        // nao_juntos (ou excluir_um sem excludedId conhecido): as duas
        // pontas estão em conflito, o usuário escolhe qual sai.
        ids.add(v.subjectId)
        ids.add(v.objectId)
      }
    }
    return ids
  }, [violations])

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof people>()
    for (const p of people) {
      const key = p.household ?? "Sem grupo"
      const list = groups.get(key)
      if (list) list.push(p)
      else groups.set(key, [p])
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [people])

  const handleChangeStatus = useCallback(
    (personId: string, status: InviteStatus) => {
      upsertInvite.mutate({ eventId, personId, status })
    },
    [upsertInvite, eventId],
  )

  const counts = useMemo(() => {
    let naLista = 0
    for (const i of invites) {
      if (ON_LIST_STATUSES.has(i.status)) naLista += 1
    }
    return { naLista, total: people.length }
  }, [invites, people])

  if (eventsLoading) {
    return (
      <SectionErrorBoundary label="GUEST EVENT">
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
      <SectionErrorBoundary label="GUEST EVENT">
        <div className="p-4">
          <p className="font-mono text-[11px] text-danger">Erro ao carregar o evento.</p>
          <Link href="/people" className="font-mono text-[11px] text-accent">← VOLTAR</Link>
        </div>
      </SectionErrorBoundary>
    )
  }

  if (!event) {
    return (
      <SectionErrorBoundary label="GUEST EVENT">
        <div className="p-4">
          <p className="font-mono text-[11px] text-on-surface/40">Evento não encontrado.</p>
          <Link href="/people" className="font-mono text-[11px] text-accent">← VOLTAR</Link>
        </div>
      </SectionErrorBoundary>
    )
  }

  return (
    <SectionErrorBoundary label="GUEST EVENT">
      <div className="p-3">
        <Link href="/people" className="font-mono text-[10px] text-on-surface/40 hover:text-accent">
          ← PESSOAS
        </Link>

        <h1 className="mt-2 text-lg text-on-surface">{event.name}</h1>
        <p className="font-mono text-[11px] text-on-surface/40">
          {counts.naLista} na lista · {counts.total} cadastradas
          {event.capacity ? ` · capacidade ${event.capacity}` : ""}
        </p>

        <div className="mt-3">
          <ViolationPanel violations={violations} />
        </div>

        {isLoading ? <div className="h-32 animate-pulse bg-on-surface/5" /> : null}

        {!isLoading
          ? grouped.map(([household, members]) => (
              <section key={household} className="mb-4">
                <h2 className="mb-1 font-mono text-[10px] tracking-wider text-on-surface/50">
                  {household.toUpperCase()}
                </h2>
                {members.map((p) => (
                  <InviteRow
                    key={p.id}
                    person={p}
                    status={statusByPerson.get(p.id) ?? "cogitado"}
                    hasBlock={blockedPeople.has(p.id)}
                    onChangeStatus={handleChangeStatus}
                  />
                ))}
              </section>
            ))
          : null}
      </div>
    </SectionErrorBoundary>
  )
}
