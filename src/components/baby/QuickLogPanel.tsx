"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useCreateBabyLog, useUpdateBabyLog, type BabyLogRow } from "@/lib/queries/baby"
import {
  feedBreastLog,
  feedBottleLog,
  diaperLog,
  sleepStartLog,
  vitaminDLog,
} from "@/lib/baby/quick-log"
import type { BabyLog } from "@/lib/schemas/baby"
import { cn } from "@/lib/utils"

const MoreLogDialog = dynamic(() => import("./MoreLogDialog").then((m) => ({ default: m.MoreLogDialog })), {
  ssr: false,
})

function QuickBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[44px] px-3 rounded-sm border text-[10px] font-mono font-semibold tracking-wider transition-colors",
        "disabled:opacity-40",
        active
          ? "border-health bg-health/20 text-health"
          : "border-border text-on-surface/70 hover:border-health hover:text-health",
      )}
    >
      {children}
    </button>
  )
}

interface QuickLogPanelProps {
  childId: string
  logs: BabyLogRow[]
  /** Quando true, só os botões mais usados (widget do Cockpit). */
  compact?: boolean
}

export function QuickLogPanel({ childId, logs, compact }: QuickLogPanelProps) {
  const create = useCreateBabyLog()
  const update = useUpdateBabyLog()
  const [ml, setMl] = useState("60")
  const [moreOpen, setMoreOpen] = useState(false)

  const openSleep = logs.find((l) => l.kind === "sleep" && !l.ended_at)
  const busy = create.isPending || update.isPending

  function log(payload: BabyLog) {
    create.mutate(payload)
  }

  function toggleSleep() {
    if (openSleep) {
      update.mutate({ id: openSleep.id, ended_at: new Date().toISOString() })
    } else {
      log(sleepStartLog(childId))
    }
  }

  function bottle() {
    const n = parseInt(ml, 10)
    if (!Number.isFinite(n) || n <= 0) return
    log(feedBottleLog(childId, n))
  }

  return (
    <div className="border border-border bg-surface rounded-sm p-4 space-y-3">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-health uppercase">
        REGISTRO RÁPIDO
      </span>
      <div className="grid grid-cols-3 gap-2">
        <QuickBtn disabled={busy} onClick={() => log(feedBreastLog(childId, "L"))}>MAMOU E</QuickBtn>
        <QuickBtn disabled={busy} onClick={() => log(feedBreastLog(childId, "R"))}>MAMOU D</QuickBtn>
        <QuickBtn disabled={busy} onClick={toggleSleep} active={!!openSleep}>
          {openSleep ? "ACORDOU" : "DORMIU"}
        </QuickBtn>
        <QuickBtn disabled={busy} onClick={() => log(diaperLog(childId, "wet"))}>XIXI</QuickBtn>
        <QuickBtn disabled={busy} onClick={() => log(diaperLog(childId, "dirty"))}>COCÔ</QuickBtn>
        <QuickBtn disabled={busy} onClick={() => log(diaperLog(childId, "both"))}>XIXI+COCÔ</QuickBtn>
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 flex gap-2">
            <input
              inputMode="numeric"
              value={ml}
              onChange={(e) => setMl(e.target.value)}
              aria-label="Mililitros da mamadeira"
              className="w-16 h-[44px] bg-bg border border-border rounded-sm px-2 text-[13px] font-mono text-on-surface text-center focus:outline-none focus:border-health"
            />
            <div className="flex-1">
              <QuickBtn disabled={busy} onClick={bottle}>MAMADEIRA ml</QuickBtn>
            </div>
          </div>
          <QuickBtn disabled={busy} onClick={() => log(vitaminDLog(childId))}>VIT D</QuickBtn>
        </div>
      )}
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        className="text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 min-h-[32px]"
      >
        + remédio, temperatura, medida, nota…
      </button>
      {create.isError && <p className="text-[11px] font-mono text-danger">Não foi possível registrar. Tente de novo.</p>}
      <MoreLogDialog open={moreOpen} onOpenChange={setMoreOpen} childId={childId} />
    </div>
  )
}
