"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
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
    href: "/inbox",
    label: "INBX",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M2 7l2-5h8l2 5M2 7v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M2 7h3l1 2h4l1-2h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
  { href: "/cockpit", label: "COCK", desc: "Cockpit" },
  { href: "/notes", label: "NOTES", desc: "Notas" },
  { href: "/projects", label: "PROJ", desc: "Projetos" },
  { href: "/calendar", label: "CAL", desc: "Calendário" },
  { href: "/review", label: "REV", desc: "Revisão" },
  { href: "/health", label: "HLTH", desc: "Saúde" },
  { href: "/meals", label: "MEAL", desc: "Refeições" },
  { href: "/habits", label: "HBT", desc: "Hábitos" },
  { href: "/reports", label: "REPS", desc: "Relatórios" },
  { href: "/settings", label: "SET", desc: "Ajustes" },
]

export function BottomNav({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname()
  const [hubOpen, setHubOpen] = useState(false)

  const hubActive = HUB_ITEMS.some((i) => pathname.startsWith(i.href))

  return (
    <>
      <nav aria-label="Navegação principal" className={cn("bg-surface/95 border-t border-border z-40", hidden ? "hidden" : "")}>
        <div className="h-14 flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.href === "/dashboard" || item.href === "/tasks"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-sm transition-colors active:scale-95",
                  active ? "text-teal" : "text-on-surface/40 hover:text-on-surface/60"
                )}
              >
                {item.icon}
                <span className="text-[10px] font-mono tracking-wider">{item.label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setHubOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-sm transition-colors active:scale-95",
              hubActive ? "text-teal" : "text-on-surface/40 hover:text-on-surface/60"
            )}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-[10px] font-mono tracking-wider">HUB</span>
          </button>
        </div>
      </nav>

      {/* Hub menu overlay — Dialog do @base-ui/react em vez de divs manuais:
          ganha role="dialog", focus trap e fecha com Escape de graça. */}
      <DialogPrimitive.Root open={hubOpen} onOpenChange={setHubOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed bottom-14 left-2 right-2 z-50 bg-surface border border-border rounded-sm shadow-2xl overflow-hidden outline-none">
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-border mb-1">
                <DialogPrimitive.Title className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                  HUB
                </DialogPrimitive.Title>
                <DialogPrimitive.Close className="text-[10px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors active:scale-95 p-2.5 -m-2.5">
                  FECHAR
                </DialogPrimitive.Close>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {HUB_ITEMS.map((item) => {
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setHubOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-3 md:p-2 min-h-[44px] rounded-sm transition-colors active:scale-95",
                        active ? "bg-teal/10 text-teal" : "text-on-surface/50 hover:bg-surface-hover hover:text-on-surface/70"
                      )}
                    >
                      <span className="text-[12px] font-mono font-semibold">{item.label}</span>
                      <span className="text-[9px] font-mono tracking-wider opacity-60">{item.desc}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
