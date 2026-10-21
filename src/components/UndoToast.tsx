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
  // Fila de toasts (até 3 visíveis): antes só cabia UM — um delete durante
  // outro descartava o desfazer anterior.
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const t = timersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const show = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const withId = { ...item, id: crypto.randomUUID() }
      setToasts((prev) => [...prev, withId].slice(-3))
      const t = setTimeout(() => dismiss(withId.id), 5000)
      timersRef.current.set(withId.id, t)
    },
    [dismiss]
  )

  useEffect(() => {
    globalShow = show
    return () => {
      globalShow = null
    }
  }, [show])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  function handleUndo(toast: ToastItem) {
    toast.onUndo?.()
    dismiss(toast.id)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // Nav (56px) + safe-area + folgas — toast nunca sobrepõe a BottomNav
        "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-200",
        "bottom-[calc(56px+max(env(safe-area-inset-bottom),8px)+16px)]",
        toasts.length > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <div className="flex flex-col gap-2 items-center">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-surface border border-border rounded-sm px-4 py-2 flex items-center gap-3 shadow-lg"
          >
            <span className="text-[11px] font-mono text-on-surface/60">{toast.label}</span>
            {toast.onUndo && (
              <button
                onClick={() => handleUndo(toast)}
                className="text-[10px] font-mono font-semibold text-teal hover:text-teal-hi tracking-wider transition-colors"
              >
                DESFAZER
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Fechar aviso"
              className="text-on-surface/60 hover:text-on-surface/60 text-[14px]"
            >
              ×
            </button>
          </div>
        ))}
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

/**
 * Dispara o toast fora de um componente React — usado pelo onError global do
 * QueryClient (criado uma vez via useState, antes do UndoToastProvider montar
 * no JSX, então não pode chamar o hook useUndoToast diretamente).
 */
export function showErrorToast(label: string) {
  globalShow?.({ label })
}
