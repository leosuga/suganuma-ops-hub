"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "DASH",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "NOTES",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M3 2.5h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 5.5h6M5 8h4M5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "TASKS",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M12 10l1.5 1.5L16 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/finance",
    label: "FIN",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v14M5 4h4.5a2.5 2.5 0 0 1 0 5H5m0 0h5a2.5 2.5 0 0 1 0 5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
]

const HUB_ITEMS = [
  { href: "/projects", label: "PROJ", desc: "Projetos" },
  { href: "/calendar", label: "CAL", desc: "Calendário" },
  { href: "/review", label: "REV", desc: "Revisão" },
  { href: "/health", label: "HLTH", desc: "Saúde" },
  { href: "/settings", label: "SET", desc: "Ajustes" },
]

export function BottomNav({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname()
  const [hubOpen, setHubOpen] = useState(false)

  const hubActive = HUB_ITEMS.some((i) => pathname.startsWith(i.href))

  return (
    <>
      <nav className={cn(
        "fixed left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-border z-40 transition-transform duration-300",
        hidden ? "translate-y-full bottom-0" : "translate-y-0 bottom-0"
      )}>
        <div className="h-14 flex items-center justify-around px-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.href === "/dashboard" || item.href === "/tasks"}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-sm transition-colors active:scale-95",
                  active ? "text-teal" : "text-on-surface/30 hover:text-on-surface/60"
                )}
              >
                {item.icon}
                <span className="text-[8px] font-mono tracking-wider">{item.label}</span>
              </Link>
            )
          })}

          {/* Hub toggle */}
          <button
            onClick={() => setHubOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-sm transition-colors active:scale-95",
              hubActive ? "text-teal" : "text-on-surface/30 hover:text-on-surface/60"
            )}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-[8px] font-mono tracking-wider">HUB</span>
          </button>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* Hub menu overlay */}
      {hubOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setHubOpen(false)}
          />
          <div className="fixed bottom-14 left-2 right-2 z-50 bg-surface border border-border rounded-sm shadow-2xl overflow-hidden">
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-border mb-1">
                <span className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">HUB</span>
                <button onClick={() => setHubOpen(false)} className="text-[10px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors active:scale-95">FECHAR</button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {HUB_ITEMS.map((item) => {
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setHubOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 md:p-2 rounded-sm transition-colors active:scale-95",
                        active ? "bg-teal/10 text-teal" : "text-on-surface/50 hover:bg-surface-hover hover:text-on-surface/70"
                      )}
                    >
                      <span className="text-[12px] font-mono font-semibold">{item.label}</span>
                      <span className="text-[7px] font-mono tracking-wider opacity-60">{item.desc}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
