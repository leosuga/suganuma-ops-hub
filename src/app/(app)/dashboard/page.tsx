"use client"

import Link from "next/link"
import { useTasks } from "@/lib/queries/tasks"
import { useTransactions } from "@/lib/queries/finance"
import { useAppointments, useProtocols, useProtocolEntries, usePregnancy } from "@/lib/queries/health"

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

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function ProtocolsSummary() {
  const { data: protocols = [] } = useProtocols()
  const active = protocols.filter((p) => p.active)
  const today = new Date().toISOString().slice(0, 10)

  const checks = active.map((p) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: entries = [] } = useProtocolEntries(p.id)
    return entries.some((e) => e.done_on === today)
  })

  const doneCount = checks.filter(Boolean).length
  const total = active.length

  if (total === 0) return null

  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        PROTOCOLOS
      </span>
      <span className={`text-[28px] font-mono font-bold leading-none ${doneCount === total ? "text-[#A8D8B0]" : "text-on-surface"}`}>
        {doneCount}/{total}
      </span>
      <span className="text-[10px] font-mono text-on-surface/30">feitos hoje</span>
    </div>
  )
}

export default function DashboardPage() {
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: transactions = [], isLoading: financeLoading } = useTransactions({ month: currentMonth() })
  const { data: appointments = [] } = useAppointments()
  const { data: pregnancy } = usePregnancy()

  const pending = tasks.filter((t) => t.status === "todo" || t.status === "doing")
  const done = tasks.filter((t) => t.status === "done")
  const urgent = pending.filter((t) => t.priority === "urgent")
  const overdue = pending.filter((t) => t.due_at && new Date(t.due_at) < new Date())

  const income = transactions.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0)
  const expense = transactions.filter((t) => t.kind === "expense" || t.kind === "tax").reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expense

  const now = new Date()
  const upcomingAppts = appointments
    .filter((a) => new Date(a.starts_at) >= now)
    .slice(0, 3)

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const isLoading = tasksLoading || financeLoading

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          SUGANUMA OPS HUB
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5 capitalize">
          {today}
        </p>
      </div>

      {/* Alertas */}
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

      {/* KPIs tasks */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-border bg-surface rounded-sm p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pendentes" value={pending.length} sub="tasks abertas" color={pending.length > 10 ? "text-amber" : "text-on-surface"} />
          <StatCard label="Concluídas" value={done.length} sub="tasks hoje" color="text-teal" />
          <StatCard label="Urgentes" value={urgent.length} sub="requerem atenção" color={urgent.length > 0 ? "text-danger" : "text-on-surface"} />
          <StatCard label="Atrasadas" value={overdue.length} sub="fora do prazo" color={overdue.length > 0 ? "text-amber" : "text-on-surface"} />
        </div>
      )}

      {/* Finance + Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Saldo mês"
          value={fmt(balance)}
          sub={financeLoading ? "..." : `${transactions.length} transações`}
          color={balance >= 0 ? "text-teal" : "text-danger"}
        />
        <StatCard
          label="Despesas"
          value={fmt(expense)}
          sub="mês atual"
          color={expense > 0 ? "text-danger" : "text-on-surface"}
        />
        {pregnancy?.due_date && (
          <StatCard
            label="Semana"
            value={pregnancy.week ?? "—"}
            sub="de gestação"
            color="text-[#A8D8B0]"
          />
        )}
        <ProtocolsSummary />
      </div>

      {/* Próximas consultas */}
      {upcomingAppts.length > 0 && (
        <div className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              PRÓXIMAS CONSULTAS
            </span>
            <Link href="/health" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
              VER TODAS →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {upcomingAppts.map((a) => {
              const date = new Date(a.starts_at)
              const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
              const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
              return (
                <div key={a.id} className="flex items-center gap-3 h-10 px-4">
                  <span className="text-[10px] font-mono text-[#A8D8B0] w-16 flex-none">{dateStr} {timeStr}</span>
                  <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{a.title}</span>
                  {a.location && <span className="text-[10px] font-mono text-on-surface/30 truncate max-w-[100px]">{a.location}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tasks por categoria */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            TASKS POR CATEGORIA
          </span>
          <Link href="/tasks" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
            VER TASKS →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {(["finance", "logistics", "personal", "health"] as const).map((cat) => {
            const count = pending.filter((t) => t.category === cat).length
            return (
              <div key={cat} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-mono text-on-surface/60 uppercase tracking-wider">{cat}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 bg-teal/30 rounded-full" style={{ width: `${Math.max(4, count * 12)}px` }} />
                  <span className="text-[12px] font-mono text-on-surface w-5 text-right">{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
