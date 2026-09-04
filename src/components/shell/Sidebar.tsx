"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { CONTEXT_CONFIG } from "@/lib/contexts"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "DASH",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 7l2-5h8l2 5M2 7v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M2 7h3l1 2h4l1-2h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/cockpit",
    label: "COCK",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "CAL",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "TASKS",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M12 10l1.5 1.5L16 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/finance",
    label: "FIN",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v14M5 4h4.5a2.5 2.5 0 0 1 0 5H5m0 0h5a2.5 2.5 0 0 1 0 5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/health",
    label: "HLTH",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 13.5S2 10 2 5.5a3.5 3.5 0 0 1 6-2.449A3.5 3.5 0 0 1 14 5.5C14 10 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "PROJ",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/people",
    label: "PPL",
    icon: (
      // Duas cabeças + ombros. Margem ≥1.5px de qualquer stroke à borda do
      // viewBox 16x16 (regra do projeto — stroke que toca a borda é clipado).
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5.5" r="2.1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.3 13.2a3.4 3.4 0 0 1 6.8 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="11.3" cy="6.6" r="1.7" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9.1 13.2a2.3 2.3 0 0 1 4.6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "REPS",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 13V8M6 13V5M10 13V3M14 13V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M1 13h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/review",
    label: "REV",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.636 3.636l2.122 2.122M10.242 10.242l2.122 2.122M3.636 12.364l2.122-2.122M10.242 5.758l2.122-2.122" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "NOTES",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 2h6l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/meals",
    label: "MEALS",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 1v14M11 1v14M3 5h10M3 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="5" y="2" width="2" height="2" rx="0.3" fill="currentColor" opacity="0.3" />
        <rect x="5" y="7" width="2" height="2" rx="0.3" fill="currentColor" opacity="0.3" />
        <rect x="5" y="12" width="2" height="2" rx="0.3" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    href: "/habits",
    label: "HBT",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8l3 3 5-5M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function SidebarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <aside className="w-14 flex flex-col bg-surface border-r border-border h-full">
      <div className="h-10 flex items-center justify-center border-b border-border flex-none">
        <span className="text-teal font-mono font-bold text-[11px] tracking-[0.2em]">S</span>
      </div>

      <nav className="flex-1 flex flex-col items-center py-3 gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={["/dashboard", "/calendar", "/tasks"].includes(item.href)}
              title={item.label}
              className={cn(
                "w-10 h-10 flex flex-col items-center justify-center rounded-sm gap-0.5 transition-colors",
                active
                  ? "text-teal bg-teal/10"
                  : "text-on-surface/40 hover:text-on-surface/60 hover:bg-surface-hover"
              )}
            >
              {item.icon}
              <span className="text-[7px] font-mono tracking-wider">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {pathname.startsWith("/notes") && (
        <div className="flex-none flex flex-col items-center gap-1 pb-2 border-t border-border pt-2">
          <span className="text-[6px] font-mono text-on-surface/40 tracking-wider mb-1">CTX</span>
          {(Object.keys(CONTEXT_CONFIG) as Array<keyof typeof CONTEXT_CONFIG>).map((ctx) => {
            const cfg = CONTEXT_CONFIG[ctx]
            const isActive = searchParams.get("ctx") === ctx
            return (
              <Link
                key={ctx}
                href={isActive ? "/notes" : `/notes?ctx=${ctx}`}
                prefetch={false}
                title={cfg.label}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-sm transition-colors",
                  isActive
                    ? cfg.bg + " border " + cfg.border
                    : "text-on-surface/40 hover:text-on-surface/50"
                )}
              >
                <span className={cn("text-[8px] font-mono font-bold", isActive ? cfg.color : "")}>
                  {ctx.slice(0, 2).toUpperCase()}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex-none pb-3 flex flex-col items-center">
        <Link
          href="/settings"
          prefetch={false}
          title="SETTINGS"
          className={cn(
            "w-10 h-10 flex flex-col items-center justify-center rounded-sm gap-0.5 transition-colors",
            pathname.startsWith("/settings")
              ? "text-teal bg-teal/10"
              : "text-on-surface/40 hover:text-on-surface/60 hover:bg-surface-hover"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.364 3.636l-1.06 1.06M4.696 11.304l-1.06 1.06M12.364 12.364l-1.06-1.06M4.696 4.696l-1.06-1.06"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[7px] font-mono tracking-wider">CFG</span>
        </Link>
      </div>
    </aside>
  )
}

export function Sidebar() {
  return (
    <Suspense fallback={
      <aside className="w-14 flex flex-col bg-surface border-r border-border h-full">
        <div className="h-10 flex items-center justify-center border-b border-border flex-none">
          <span className="text-teal font-mono font-bold text-[11px] tracking-[0.2em]">S</span>
        </div>
      </aside>
    }>
      <SidebarInner />
    </Suspense>
  )
}