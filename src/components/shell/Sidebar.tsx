"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
    label: "HUB",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 13.5S2 10 2 5.5a3.5 3.5 0 0 1 6-2.449A3.5 3.5 0 0 1 14 5.5C14 10 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-14 flex flex-col bg-surface border-r border-border h-full">
      {/* Logo mark */}
      <div className="h-10 flex items-center justify-center border-b border-border flex-none">
        <span className="text-teal font-mono font-bold text-[11px] tracking-[0.2em]">S</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center py-3 gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "w-10 h-10 flex flex-col items-center justify-center rounded-sm gap-0.5 transition-colors",
                active
                  ? "text-teal bg-teal/10"
                  : "text-on-surface/30 hover:text-on-surface/60 hover:bg-surface-hover"
              )}
            >
              {item.icon}
              <span className="text-[7px] font-mono tracking-wider">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="flex-none pb-3 flex flex-col items-center">
        <Link
          href="/settings"
          title="SETTINGS"
          className={cn(
            "w-10 h-10 flex flex-col items-center justify-center rounded-sm gap-0.5 transition-colors",
            pathname.startsWith("/settings")
              ? "text-teal bg-teal/10"
              : "text-on-surface/30 hover:text-on-surface/60 hover:bg-surface-hover"
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
