"use client"

import { useEffect, useMemo } from "react"
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
import { projectKeys } from "@/lib/queries/projects"
import { noteKeys } from "@/lib/queries/notes"
import { annualEventKeys } from "@/lib/queries/annual"
import { CONTEXT_CONFIG, parseContextTags } from "@/lib/contexts"
import { cn } from "@/lib/utils"
import type { TaskRow } from "@/lib/queries/tasks"
import type { TransactionRow } from "@/lib/queries/finance"
import type { AppointmentRow } from "@/lib/queries/health"
import type { ProjectRow } from "@/lib/queries/projects"
import type { NoteRow } from "@/lib/queries/notes"
import type { AnnualEventRow } from "@/lib/types"

const NAV_COMMANDS = [
  { label: "Dashboard", href: "/dashboard", shortcut: "D" },
  { label: "Calendar", href: "/calendar", shortcut: "C" },
  { label: "Year Calendar", href: "/calendar/year", shortcut: "Y" },
  { label: "Task Engine", href: "/tasks", shortcut: "T" },
  { label: "Finance Hub", href: "/finance", shortcut: "F" },
  { label: "Health Hub", href: "/health", shortcut: "H" },
  { label: "Reports", href: "/reports", shortcut: "R" },
  { label: "Review", href: "/review", shortcut: "W" },
  { label: "Projects", href: "/projects", shortcut: "J" },
  { label: "Notes", href: "/notes", shortcut: "N" },
  { label: "Meal Planning", href: "/meals", shortcut: "M" },
  { label: "Habits Tracker", href: "/habits", shortcut: "B" },
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
  const projects = queryClient.getQueryData<ProjectRow[]>(projectKeys.all) ?? []
  const notes = queryClient.getQueryData<NoteRow[]>(noteKeys.all) ?? []
  const events = queryClient.getQueryData<AnnualEventRow[]>(annualEventKeys.year(new Date().getFullYear())) ?? []

  const pendingTasks = tasks.filter((t) => t.status === "todo" || t.status === "doing").slice(0, 5)
  const recentTxns = transactions.slice(0, 5)
  const upcomingAppts = appointments
    .filter((a) => new Date(a.starts_at) >= new Date())
    .slice(0, 3)
  const activeProjects = projects.filter((p) => p.status === "active").slice(0, 5)
  const favoritedNotes = notes.filter((n) => n.favorited).slice(0, 3)
  const pinnedNotes = notes.filter((n) => n.pinned).slice(0, 3)
  const upcomingEvents = events
    .filter((e) => e.end_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5)

  // Unique tags from notes (excluding ctx/ tags which have their own group)
  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {}
    for (const n of notes) {
      for (const tag of n.tags ?? []) {
        if (!tag.startsWith("ctx/")) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        }
      }
    }
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag)
  }, [notes])

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

        <CommandGroup heading="Contextos">
          {Object.entries(CONTEXT_CONFIG).map(([ctx, cfg]) => (
            <CommandItem key={`nav-ctx-${ctx}`} value={`ctx ${cfg.label}`} onSelect={() => navigate(`/notes?ctx=${ctx}`)}>
              <span className="flex-1 font-mono text-[12px]">{cfg.label}</span>
              <span className={cn("ml-auto text-[9px] font-mono px-1 rounded-sm", cfg.bg, cfg.color)}>
                {ctx}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {allTags.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tags">
              {allTags.map((tag) => (
                <CommandItem key={`tag-${tag}`} value={`tag ${tag}`} onSelect={() => navigate(`/notes?search=${encodeURIComponent(tag)}`)}>
                  <span className="flex-1 font-mono text-[12px]">#{tag}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

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

        {upcomingEvents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Próximos eventos">
              {upcomingEvents.map((e) => (
                <CommandItem key={e.id} value={`event ${e.title}`} onSelect={() => navigate("/calendar/year")}>
                  <span className="flex-1 font-mono text-[12px] truncate">{e.title}</span>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                    {new Date(e.start_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {activeProjects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projetos ativos">
              {activeProjects.map((p) => (
                <CommandItem key={p.id} value={`project ${p.name}`} onSelect={() => navigate(`/tasks?project=${p.id}`)}>
                  <span className="flex-1 font-mono text-[12px] truncate">{p.name}</span>
                  <span
                    className="ml-auto w-2 h-2 rounded-full flex-none"
                    style={{ backgroundColor: p.color }}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {favoritedNotes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notas favoritas">
              {favoritedNotes.map((n) => (
                <CommandItem key={n.id} value={`fav ${n.title}`} onSelect={() => navigate("/notes")}>
                  <span className="flex-1 font-mono text-[12px] truncate">{n.title || "Nota sem título"}</span>
                  <span className="ml-auto text-[9px] font-mono text-danger">♥</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {pinnedNotes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notas fixadas">
              {pinnedNotes.map((n) => (
                <CommandItem key={n.id} value={`note ${n.title}`} onSelect={() => navigate("/notes")}>
                  <span className="flex-1 font-mono text-[12px] truncate">{n.title || "Nota sem título"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {Object.entries(CONTEXT_CONFIG).map(([ctx, cfg]) => {
          const ctxNotes = notes.filter((n) => parseContextTags(n.tags).includes(ctx)).slice(0, 3)
          if (ctxNotes.length === 0) return null
          return (
            <div key={ctx}>
              <CommandSeparator />
              <CommandGroup heading={`Notas: ${cfg.label}`}>
                {ctxNotes.map((n) => (
                  <CommandItem
                    key={n.id}
                    value={`ctx ${ctx} ${n.title}`}
                    onSelect={() => navigate(`/notes?ctx=${ctx}`)}
                  >
                    <span className="flex-1 font-mono text-[12px] truncate">{n.title || "Nota sem título"}</span>
                    <span className={cn("ml-auto text-[9px] font-mono px-1 rounded-sm", cfg.bg, cfg.color)}>
                      {ctx}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
