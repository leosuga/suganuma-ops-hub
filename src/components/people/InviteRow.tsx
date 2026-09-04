"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import type { InviteStatus, PersonRow } from "@/lib/types"

const STATUSES: { value: InviteStatus; label: string }[] = [
  { value: "cogitado", label: "?" },
  { value: "convidar", label: "CONVIDAR" },
  { value: "convidado", label: "CONVIDADO" },
  { value: "confirmado", label: "CONFIRMOU" },
  { value: "recusou", label: "RECUSOU" },
  { value: "vetado", label: "VETADO" },
]

interface Props {
  person: PersonRow
  status: InviteStatus
  hasBlock: boolean
  onChangeStatus: (personId: string, status: InviteStatus) => void
}

export const InviteRow = memo(function InviteRow({
  person,
  status,
  hasBlock,
  onChangeStatus,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-on-surface/10 px-2 py-1.5",
        hasBlock && "bg-danger/5",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
        {person.name}
        {hasBlock ? <span className="ml-2 font-mono text-[10px] text-danger">⚠</span> : null}
      </span>
      <select
        className="shrink-0 border border-on-surface/20 bg-surface px-1.5 py-1 font-mono text-[10px] text-on-surface"
        value={status}
        aria-label={`Status de ${person.name}`}
        onChange={(e) => onChangeStatus(person.id, e.target.value as InviteStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
})
