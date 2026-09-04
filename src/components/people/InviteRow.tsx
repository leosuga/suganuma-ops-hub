"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import type { InviteStatus, PersonRow } from "@/lib/types"
import { INVITE_STATUS_ORDER, INVITE_STATUS_LABEL } from "@/lib/people/labels"

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
        {INVITE_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{INVITE_STATUS_LABEL[s]}</option>
        ))}
      </select>
    </div>
  )
})
