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
      // Grid 18×18, conteúdo dentro de 1.5..16.5 — stroke nunca toca a borda
      // do viewBox (SVG clipa em overflow default; tocava = ícone cortado).
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10.5" y="2" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2" y="10.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/inbox",
    label: "INBX",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 8.5L5 3.5h8l2 5M3 8.5v5a1.2 1.2 0 0 0 1.2 1.2h9.6a1.2 1.2 0 0 0 1.2-1.2v-5M3 8.5h3.2l1 2h3.6l1-2H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "TASKS",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2.5 5h13M2.5 9h8M2.5 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M12.5 11.5l1.7 1.7 2.3-2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/finance",
    label: "FIN",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2v14M5.8 5h4.2a2.4 2.4 0 0 1 0 4.8H5.8m0 0h5a2.4 2.4 0 0 1 0 4.8H5.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
      <nav aria-label="Navegação principal" className={cn(
        "bg-surface/95 border-t border-border z-40",
        // Safe-area FORA da altura fixa: h-14 do inner deve conter só o conteúdo.
        // Padding dentro de h-14 (border-box) esmagava os ícones com inset de 34px
        // do home indicator do iPhone. max(...,8px) dá respiro mínimo no desktop.
        "pb-[max(env(safe-area-inset-bottom),8px)]",
        hidden ? "hidden" : ""
      )}>
        <div className="h-14 flex items-center justify-around px-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.href === "/dashboard" || item.href === "/tasks"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-md transition-colors",
                  active
                    ? "bg-teal/10 text-teal"
                    : "text-on-surface/40 hover:text-on-surface/60"
                )}
              >
                {item.icon}
                <span className="text-[10px] font-mono tracking-wider">{item.label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setHubOpen(true)}
            aria-label="Abrir menu HUB"
            aria-haspopup="dialog"
            aria-expanded={hubOpen}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-md transition-colors",
              hubActive
                ? "bg-teal/10 text-teal"
                : "text-on-surface/40 hover:text-on-surface/60"
            )}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <rect x="11" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="11" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <rect x="11" y="11" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
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
          <DialogPrimitive.Popup className="fixed left-2 right-2 z-50 bg-surface border border-border rounded-sm shadow-2xl overflow-hidden outline-none bottom-[calc(56px+max(env(safe-area-inset-bottom),8px)+8px)]">
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
                        "flex flex-col items-center justify-center gap-1 p-3 md:p-2 min-h-[44px] rounded-md transition-colors active:scale-95",
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
