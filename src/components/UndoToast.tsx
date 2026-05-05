"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ToastItem {
  id: string
  label: string
  onUndo?: () => void
}

type ToastHook = {
  show: (item: Omit<ToastItem, "id">) => void
}

let globalShow: ((item: Omit<ToastItem, "id">) => void) | null = null

function ToastBar() {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((item: Omit<ToastItem, "id">) => {
    const withId = { ...item, id: crypto.randomUUID() }
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(withId)
    timerRef.current = setTimeout(() => {
      setToast(null)
    }, 5000)
  }, [])

  useEffect(() => {
    globalShow = show
    return () => { globalShow = null }
  }, [show])

  function handleUndo() {
    if (toast?.onUndo) toast.onUndo()
    setToast(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return (
    <div className={cn(
      "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-200",
      toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
    )}>
      <div className="bg-surface border border-border rounded-sm px-4 py-2 flex items-center gap-3 shadow-lg">
        <span className="text-[11px] font-mono text-on-surface/60">{toast?.label ?? ""}</span>
        {toast?.onUndo && (
          <button onClick={handleUndo} className="text-[10px] font-mono font-semibold text-teal hover:text-teal-hi tracking-wider transition-colors">
            DESFAZER
          </button>
        )}
        <button onClick={() => setToast(null)} className="text-on-surface/30 hover:text-on-surface/60 text-[14px]">×</button>
      </div>
    </div>
  )
}

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastBar />
    </>
  )
}

export function useUndoToast(): ToastHook {
  const show = useCallback((item: Omit<ToastItem, "id">) => {
    globalShow?.(item)
  }, [])

  return { show }
}
