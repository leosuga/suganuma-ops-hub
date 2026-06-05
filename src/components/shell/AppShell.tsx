"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { TopBar } from "./TopBar"
import { logger } from "@/lib/logger"
import { useNotifications } from "@/lib/notifications"
import { useInitAccent } from "@/lib/theme"
import { UndoToastProvider } from "@/components/UndoToast"

const CommandPalette = dynamic(() => import("./CommandPalette").then(m => ({ default: m.CommandPalette })), { ssr: false })

interface AppShellProps {
  children: React.ReactNode
  user: { email: string }
}

export function AppShell({ children, user }: AppShellProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }).catch(() => {})
    }
  }, [])

  useNotifications()
  useInitAccent()

  // Detect keyboard visibility on mobile (viewport height changes)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const initialHeight = window.visualViewport?.height ?? window.innerHeight
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height ?? window.innerHeight
      const keyboardUp = currentHeight < initialHeight * 0.75
      setKeyboardVisible(keyboardUp)
    }
    window.visualViewport?.addEventListener("resize", handleResize)
    window.addEventListener("resize", handleResize)
    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
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
    <UndoToastProvider>
      <div className="flex min-h-[100dvh] h-[100dvh] overflow-hidden bg-bg">
        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-none">
          <Sidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <TopBar user={user} onOpenCommand={() => setCmdOpen(true)} />

          {/* Page content — bottom padding for BottomNav + safe area on mobile */}
          <main className="flex-1 overflow-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav — hidden when keyboard is open */}
      <div className="md:hidden">
        <BottomNav hidden={keyboardVisible} />
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </UndoToastProvider>
    </QueryClientProvider>
  )
}
