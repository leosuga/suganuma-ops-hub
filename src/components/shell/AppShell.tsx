"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { TopBar } from "./TopBar"
import { logger } from "@/lib/logger"

const CommandPalette = dynamic(() => import("./CommandPalette").then(m => ({ default: m.CommandPalette })), { ssr: false })

interface AppShellProps {
  children: React.ReactNode
  user: { email: string }
}

export function AppShell({ children, user }: AppShellProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
    }
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
          mutations: {
            onError: (error) => {
              logger.error("mutation", "mutation failed", { error: String(error) })
            },
          },
        },
      })
  )
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen overflow-hidden bg-bg">
        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-none">
          <Sidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <TopBar user={user} onOpenCommand={() => setCmdOpen(true)} />

          {/* Page content — add bottom padding on mobile for BottomNav */}
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </QueryClientProvider>
  )
}
