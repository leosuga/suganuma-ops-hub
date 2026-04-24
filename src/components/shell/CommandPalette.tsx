"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"

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

export function CommandPalette({
  open,
  onOpenChange,
  onAddTask,
}: CommandPaletteProps) {
  const router = useRouter()

  // Keyboard shortcut CMD+K / CTRL+K
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
      description="Navegue pelo Suganuma Ops Hub"
    >
      <CommandInput placeholder="Buscar comando..." />
      <CommandList>
        <CommandEmpty>Nenhum comando encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          {NAV_COMMANDS.map((cmd) => (
            <CommandItem
              key={cmd.href}
              value={cmd.label}
              onSelect={() => navigate(cmd.href)}
            >
              <span className="flex-1 font-mono text-[12px]">{cmd.label}</span>
              <kbd className="ml-auto text-[9px] font-mono text-muted-foreground">
                {cmd.shortcut}
              </kbd>
            </CommandItem>
          ))}
        </CommandGroup>

        {onAddTask && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ações">
              <CommandItem
                value="nova task"
                onSelect={() => {
                  onOpenChange(false)
                  onAddTask()
                }}
              >
                <span className="font-mono text-[12px]">+ Nova Task</span>
                <kbd className="ml-auto text-[9px] font-mono text-muted-foreground">N</kbd>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
