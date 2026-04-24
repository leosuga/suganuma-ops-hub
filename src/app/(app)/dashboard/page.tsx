"use client"

import { useTasks } from "@/lib/queries/tasks"

function StatCard({
  label,
  value,
  sub,
  color = "text-on-surface",
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        {label}
      </span>
      <span className={`text-[28px] font-mono font-bold leading-none ${color}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[10px] font-mono text-on-surface/30">{sub}</span>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { data: tasks = [], isLoading } = useTasks()

  const pending = tasks.filter((t) => t.status === "todo" || t.status === "doing")
  const done = tasks.filter((t) => t.status === "done")
  const urgent = pending.filter((t) => t.priority === "urgent")
  const overdue = pending.filter(
    (t) => t.due_at && new Date(t.due_at) < new Date()
  )

  const byCategory = {
    finance: pending.filter((t) => t.category === "finance").length,
    logistics: pending.filter((t) => t.category === "logistics").length,
    personal: pending.filter((t) => t.category === "personal").length,
    health: pending.filter((t) => t.category === "health").length,
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          SUGANUMA OPS HUB
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5 capitalize">
          {today}
        </p>
      </div>

      {/* Status bar */}
      {urgent.length > 0 && (
        <div className="border border-danger/40 bg-danger/5 rounded-sm px-4 py-2.5 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse flex-none" />
          <span className="text-[11px] font-mono text-danger">
            {urgent.length} {urgent.length === 1 ? "task urgente" : "tasks urgentes"} pendente{urgent.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="border border-amber/40 bg-amber/5 rounded-sm px-4 py-2.5 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse flex-none" />
          <span className="text-[11px] font-mono text-amber">
            {overdue.length} {overdue.length === 1 ? "task atrasada" : "tasks atrasadas"}
          </span>
        </div>
      )}

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-border bg-surface rounded-sm p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Pendentes"
            value={pending.length}
            sub="tasks abertas"
            color={pending.length > 10 ? "text-amber" : "text-on-surface"}
          />
          <StatCard
            label="Concluídas"
            value={done.length}
            sub="tasks hoje"
            color="text-teal"
          />
          <StatCard
            label="Urgentes"
            value={urgent.length}
            sub="requerem atenção"
            color={urgent.length > 0 ? "text-danger" : "text-on-surface"}
          />
          <StatCard
            label="Atrasadas"
            value={overdue.length}
            sub="fora do prazo"
            color={overdue.length > 0 ? "text-amber" : "text-on-surface"}
          />
        </div>
      )}

      {/* Tasks por categoria */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            TASKS POR CATEGORIA
          </span>
        </div>
        <div className="divide-y divide-border">
          {Object.entries(byCategory).map(([cat, count]) => (
            <div key={cat} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-mono text-on-surface/60 uppercase tracking-wider">
                {cat}
              </span>
              <div className="flex items-center gap-3">
                <div
                  className="h-1.5 bg-teal/30 rounded-full"
                  style={{ width: `${Math.max(4, count * 12)}px` }}
                />
                <span className="text-[12px] font-mono text-on-surface w-5 text-right">
                  {count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos futuros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-border bg-surface rounded-sm p-4 opacity-40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              FINANCE HUB
            </span>
            <span className="text-[8px] font-mono text-on-surface/30 border border-border px-1.5 rounded-sm">
              FASE 2
            </span>
          </div>
          <p className="text-[11px] font-mono text-on-surface/30">
            Transações, saldo e relatórios financeiros
          </p>
        </div>

        <div className="border border-border bg-surface rounded-sm p-4 opacity-40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              HEALTH HUB
            </span>
            <span className="text-[8px] font-mono text-on-surface/30 border border-border px-1.5 rounded-sm">
              FASE 3
            </span>
          </div>
          <p className="text-[11px] font-mono text-on-surface/30">
            Acompanhamento de saúde, gravidez e protocolos
          </p>
        </div>
      </div>
    </div>
  )
}
