"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { HealthLogRow } from "@/lib/queries/health"

interface HealthTrendsProps {
  logs: HealthLogRow[]
  kind: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function extractWeightData(logs: HealthLogRow[]) {
  return logs
    .filter((l) => l.kind === "weight")
    .map((l) => {
      const val = l.value as { kg?: number }
      return { date: formatDate(l.logged_at), kg: val.kg ?? 0, rawDate: l.logged_at }
    })
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    .slice(-30)
}

function extractBpData(logs: HealthLogRow[]) {
  return logs
    .filter((l) => l.kind === "blood_pressure")
    .map((l) => {
      const val = l.value as { systolic?: number; diastolic?: number }
      return {
        date: formatDate(l.logged_at),
        systolic: val.systolic ?? 0,
        diastolic: val.diastolic ?? 0,
        rawDate: l.logged_at,
      }
    })
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    .slice(-30)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
      <p className="text-on-surface/40 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.value.toFixed(1)} kg
        </p>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BpTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
      <p className="text-on-surface/40 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "systolic" ? "Sistólica" : "Diastólica"}: {p.value}
        </p>
      ))}
    </div>
  )
}

export function WeightChart({ logs }: HealthTrendsProps) {
  const data = extractWeightData(logs)

  if (data.length < 2) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 h-48 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">
          Dados insuficientes para gráfico
        </span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm p-4">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
        PESO
      </span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            hide
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          <Tooltip content={<WeightTooltip />} cursor={{ stroke: "rgba(168,216,176,0.2)", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="kg"
            stroke="#A8D8B0"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "#A8D8B0" }}
            activeDot={{ r: 4, fill: "#A8D8B0" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BloodPressureChart({ logs }: HealthTrendsProps) {
  const data = extractBpData(logs)

  if (data.length < 2) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 h-48 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">
          Dados insuficientes para gráfico
        </span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm p-4">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
        PRESSÃO ARTERIAL
      </span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip content={<BpTooltip />} cursor={{ stroke: "rgba(168,216,176,0.2)", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="systolic"
            stroke="#FFB4AB"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "#FFB4AB" }}
            activeDot={{ r: 4, fill: "#FFB4AB" }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            stroke="#55D7ED"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "#55D7ED" }}
            activeDot={{ r: 4, fill: "#55D7ED" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
