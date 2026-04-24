"use client"

import { cn } from "@/lib/utils"

type Category = "finance" | "logistics" | "personal" | "health"

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "finance", label: "FINANCE" },
  { value: "logistics", label: "LOGISTICS" },
  { value: "personal", label: "PERSONAL" },
  { value: "health", label: "HEALTH" },
]

interface CategoryChipsProps {
  value: Category | null
  onChange: (v: Category | null) => void
  counts?: Partial<Record<Category, number>>
}

export function CategoryChips({ value, onChange, counts }: CategoryChipsProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto no-scrollbar">
      <button
        onClick={() => onChange(null)}
        className={cn(
          "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
          value === null
            ? "bg-teal/15 text-teal border border-teal/40"
            : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
        )}
      >
        ALL
        {counts && (
          <span className="ml-1 opacity-60">
            {Object.values(counts).reduce((a, b) => a + b, 0)}
          </span>
        )}
      </button>

      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(value === cat.value ? null : cat.value)}
          className={cn(
            "flex-none h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-widest transition-colors",
            value === cat.value
              ? "bg-teal/15 text-teal border border-teal/40"
              : "text-on-surface/40 border border-border hover:border-on-surface/30 hover:text-on-surface/60"
          )}
        >
          {cat.label}
          {counts?.[cat.value] !== undefined && (
            <span className="ml-1 opacity-60">{counts[cat.value]}</span>
          )}
        </button>
      ))}
    </div>
  )
}
