"use client"

import { memo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { PersonRow as PersonRowType } from "@/lib/types"

const SIDE_LABEL: Record<string, string> = {
  leo: "MEU",
  parceira: "DELA",
  comum: "COMUM",
  outro: "—",
}

const CIRCLE_LABEL: Record<string, string> = {
  familia_nuclear: "Família nuclear",
  familia_extensa: "Família extensa",
  amigos: "Amigos",
  trabalho: "Trabalho",
  vizinhos: "Vizinhos",
  outro: "Outro",
}

interface Props {
  person: PersonRowType
  conflictCount: number
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const PersonRow = memo(function PersonRow({
  person,
  conflictCount,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-on-surface/10 px-3 py-2">
      <div className="min-w-0 flex-1">
        <Link
          href={`/people/${person.id}`}
          className="block truncate text-sm text-on-surface hover:text-accent"
        >
          {person.name}
          {person.nickname ? (
            <span className="text-on-surface/40"> ({person.nickname})</span>
          ) : null}
        </Link>
        <div className="truncate text-[11px] text-on-surface/40">
          {CIRCLE_LABEL[person.circle] ?? person.circle}
          {person.household ? ` · ${person.household}` : ""}
        </div>
      </div>

      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
          person.side === "parceira" && "bg-accent/15 text-accent",
          person.side !== "parceira" && "bg-on-surface/10 text-on-surface/60",
        )}
      >
        {SIDE_LABEL[person.side] ?? person.side}
      </span>

      {conflictCount > 0 ? (
        <span
          className="shrink-0 rounded bg-danger/15 px-1.5 py-0.5 font-mono text-[10px] text-danger"
          title={`${conflictCount} conflito(s) ativo(s)`}
        >
          ⚠ {conflictCount}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onEdit(person.id)}
        className="shrink-0 px-2 py-1 font-mono text-[10px] text-on-surface/60 hover:text-on-surface"
      >
        EDIT
      </button>
      <button
        type="button"
        onClick={() => onDelete(person.id)}
        className="shrink-0 px-2 py-1 font-mono text-[10px] text-on-surface/40 hover:text-danger"
      >
        DEL
      </button>
    </div>
  )
})
