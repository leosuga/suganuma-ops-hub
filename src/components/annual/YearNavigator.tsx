"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

interface YearNavigatorProps {
  year: number
  onChange: (year: number) => void
}

export function YearNavigator({ year, onChange }: YearNavigatorProps) {
  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-border flex-none">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/40 uppercase">
          YEAR VIEW
        </span>
        <button
          onClick={() => onChange(new Date().getFullYear())}
          className="text-[9px] font-mono text-teal hover:text-teal-hi tracking-wider transition-colors"
        >
          HOJE
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(year - 1)}
          className="w-6 h-6 flex items-center justify-center text-on-surface/40 hover:text-on-surface/70 font-mono transition-colors"
          aria-label="Ano anterior"
        >
          ‹
        </button>
        <span className="text-[13px] font-mono text-on-surface/80 min-w-16 text-center font-semibold">
          {year}
        </span>
        <button
          onClick={() => onChange(year + 1)}
          className="w-6 h-6 flex items-center justify-center text-on-surface/40 hover:text-on-surface/70 font-mono transition-colors"
          aria-label="Próximo ano"
        >
          ›
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/calendar" className="text-[9px] font-mono text-on-surface/40 hover:text-teal/80 tracking-wider transition-colors border-l border-border pl-2 ml-1">
          MÊS →
        </Link>
      </div>
    </div>
  )
}
