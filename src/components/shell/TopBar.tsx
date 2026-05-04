"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "DASHBOARD",
  "/calendar": "CALENDAR",
  "/tasks": "TASK ENGINE",
  "/finance": "FINANCE HUB",
  "/health": "HEALTH HUB",
  "/notes": "NOTES",
  "/meals": "MEAL PLANNING",
  "/habits": "HABITS TRACKER",
  "/settings": "SETTINGS",
}

interface TopBarProps {
  user: { email: string }
  onOpenCommand: () => void
}

export function TopBar({ user, onOpenCommand }: TopBarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const pageLabel =
    Object.entries(PAGE_LABELS).find(([key]) =>
      pathname.startsWith(key)
    )?.[1] ?? "OPS HUB"

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "SG"

  return (
    <header className="h-10 flex items-center justify-between px-4 border-b border-border bg-surface flex-none">
      <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/60 uppercase">
        {pageLabel}
      </span>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-on-surface/70 transition-colors text-[13px]"
          >
            {theme === "dark" ? "☀" : "◑"}
          </button>
        )}

        {/* CMD+K button */}
        <button
          onClick={onOpenCommand}
          aria-label="Abrir paleta de comandos (Cmd+K)"
          className="hidden md:flex items-center gap-1.5 h-6 px-2 border border-border rounded-sm text-on-surface/30 hover:text-on-surface/60 hover:border-on-surface/30 transition-colors"
        >
          <span className="text-[9px] font-mono tracking-wider">CMD</span>
          <kbd className="text-[9px] font-mono">+K</kbd>
        </button>

        {/* User avatar */}
        <div
          title={user.email}
          className="w-6 h-6 rounded-full bg-teal/20 border border-teal/40 flex items-center justify-center"
          aria-label={`Usuário: ${user.email}`}
        >
          <span className="text-[8px] font-mono font-bold text-teal" aria-hidden="true">{initials}</span>
        </div>
      </div>
    </header>
  )
}
