"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"

// No-op durante SSR: window/localStorage não existem no render do servidor.
const noopPersister: Persister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
}
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { TopBar } from "./TopBar"
import { logger } from "@/lib/logger"
import { useNotifications } from "@/lib/notifications"
import { useInitAccent } from "@/lib/theme"
import { UndoToastProvider, showErrorToast } from "@/components/UndoToast"

const CommandPalette = dynamic(() => import("./CommandPalette").then(m => ({ default: m.CommandPalette })), { ssr: false })
const QuickAddDialog = dynamic(() => import("@/components/tasks/QuickAddDialog").then(m => ({ default: m.QuickAddDialog })), { ssr: false })

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
              // Sem isso o optimistic update reverte em silêncio — o usuário
              // via o dado "salvo" sumir sem nenhuma explicação.
              showErrorToast("Falha ao salvar — tente novamente")
            },
          },
        },
      })
  )
  const [persister] = useState<Persister>(() =>
    typeof window !== "undefined"
      ? createSyncStoragePersister({ storage: window.localStorage, key: "ops-hub-query-cache" })
      : noopPersister
  )
  const [cmdOpen, setCmdOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
    <UndoToastProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-bg">
        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-none">
          <Sidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <TopBar user={user} onOpenCommand={() => setCmdOpen(true)} />

          <main className="flex-1 overflow-auto">
            {children}
          </main>

          {/* Mobile bottom nav — inside flex, always at bottom */}
          <div className="md:hidden flex-none">
            <BottomNav hidden={keyboardVisible} />
          </div>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onAddTask={() => setQuickAddOpen(true)} />
      <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </UndoToastProvider>
    </PersistQueryClientProvider>
  )
}
