"use client"

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
  {
    href: "/health",
    label: "HUB",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M8 13.5S2 10 2 5.5a3.5 3.5 0 0 1 6-2.449A3.5 3.5 0 0 1 14 5.5C14 10 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border flex items-center justify-around px-2 z-40">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-sm transition-colors",
              active
                ? "text-teal"
                : "text-on-surface/30 hover:text-on-surface/60"
            )}
          >
            {item.icon}
            <span className="text-[8px] font-mono tracking-wider">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
