"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { taskKeys } from "@/lib/queries/tasks"
import { financeKeys } from "@/lib/queries/finance"
import { healthKeys } from "@/lib/queries/health"
import type { TaskRow } from "@/lib/queries/tasks"
import type { TransactionRow } from "@/lib/queries/finance"
import type { AppointmentRow } from "@/lib/queries/health"

const NAV_COMMANDS = [
  { label: "Dashboard", href: "/dashboard", shortcut: "D" },
  { label: "Task Engine", href: "/tasks", shortcut: "T" },
  { label: "Finance Hub", href: "/finance", shortcut: "F" },
  { label: "Health Hub", href: "/health", shortcut: "H" },
  { label: "Settings", href: "/settings", shortcut: "S" },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTask?: () => void
}

export function CommandPalette({ open, onOpenChange, onAddTask }: CommandPaletteProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const tasks = queryClient.getQueryData<TaskRow[]>(taskKeys.all) ?? []
  const transactions = queryClient.getQueryData<TransactionRow[]>(financeKeys.transactions()) ?? []
  const appointments = queryClient.getQueryData<AppointmentRow[]>(healthKeys.appointments) ?? []

  const pendingTasks = tasks.filter((t) => t.status === "todo" || t.status === "doing").slice(0, 5)
  const recentTxns = transactions.slice(0, 5)
  const upcomingAppts = appointments
    .filter((a) => new Date(a.starts_at) >= new Date())
    .slice(0, 3)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onOpenChange])

  function navigate(href: string) {
    router.push(href)
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => onOpenChange(v)}
      title="Command Palette"
      description="Navegue, busque tasks, transações e consultas"
    >
      <CommandInput placeholder="Buscar..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          {NAV_COMMANDS.map((cmd) => (
            <CommandItem key={cmd.href} value={cmd.label} onSelect={() => navigate(cmd.href)}>
              <span className="flex-1 font-mono text-[12px]">{cmd.label}</span>
              <kbd className="ml-auto text-[9px] font-mono text-muted-foreground">{cmd.shortcut}</kbd>
            </CommandItem>
          ))}
        </CommandGroup>

        {onAddTask && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ações">
              <CommandItem value="nova task" onSelect={() => { onOpenChange(false); onAddTask() }}>
                <span className="font-mono text-[12px]">+ Nova Task</span>
                <kbd className="ml-auto text-[9px] font-mono text-muted-foreground">N</kbd>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {pendingTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks pendentes">
              {pendingTasks.map((t) => (
                <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => navigate("/tasks")}>
                  <span className="flex-1 font-mono text-[12px] truncate">{t.title}</span>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground uppercase">{t.priority}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {recentTxns.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Transações recentes">
              {recentTxns.map((t) => (
                <CommandItem key={t.id} value={`txn ${t.description ?? t.category ?? t.occurred_on}`} onSelect={() => navigate("/finance")}>
                  <span className="flex-1 font-mono text-[12px] truncate">{t.description || t.category || t.occurred_on}</span>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground tabular-nums">
                    {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {upcomingAppts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Próximas consultas">
              {upcomingAppts.map((a) => (
                <CommandItem key={a.id} value={`appt ${a.title}`} onSelect={() => navigate("/health")}>
                  <span className="flex-1 font-mono text-[12px] truncate">{a.title}</span>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                    {new Date(a.starts_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
