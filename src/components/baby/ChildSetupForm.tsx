"use client"

import { useState } from "react"
import { useUpsertChild } from "@/lib/queries/baby"
import { usePregnancy } from "@/lib/queries/health"
import { fromLocalInput } from "@/lib/baby/quick-log"
import { cn } from "@/lib/utils"

const inputClass =
  "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-health transition-colors"
const labelClass = "text-[9px] font-mono text-on-surface/40 uppercase tracking-widest block mb-1"

function toPositive(v: string): number | null {
  const n = parseFloat(v.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function ChildSetupForm() {
  const upsert = useUpsertChild()
  const { data: pregnancy } = usePregnancy()
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [weight, setWeight] = useState("")
  const [length, setLength] = useState("")
  const [head, setHead] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const birthAt = date ? fromLocalInput(`${date}T${time || "12:00"}`) : null
    if (!name.trim() || !birthAt) {
      setError("Informe o nome e a data de nascimento.")
      return
    }
    setError("")
    const w = toPositive(weight)
    await upsert.mutateAsync({
      name: name.trim(),
      birth_at: birthAt,
      birth_weight_g: w ? Math.round(w) : null,
      birth_length_cm: toPositive(length),
      birth_head_cm: toPositive(head),
      pregnancy_id: pregnancy?.id ?? null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-3 max-w-md">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-health uppercase">
        CADASTRAR A BEBÊ
      </span>
      <div>
        <label className={labelClass}>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Data de nascimento</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Hora (opcional)</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Peso (g)</label>
          <input inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="3200" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Compr. (cm)</label>
          <input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} placeholder="49" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>PC (cm)</label>
          <input inputMode="decimal" value={head} onChange={(e) => setHead(e.target.value)} placeholder="34" className={inputClass} />
        </div>
      </div>
      {error && <p className="text-[11px] font-mono text-danger">{error}</p>}
      <button
        type="submit"
        disabled={upsert.isPending}
        className={cn(
          "h-9 px-4 self-end border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm",
          "hover:bg-health/20 disabled:opacity-30 transition-colors",
        )}
      >
        {upsert.isPending ? "SALVANDO..." : "SALVAR →"}
      </button>
    </form>
  )
}
