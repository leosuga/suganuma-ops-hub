"use client"

import { useState, useEffect } from "react"

/**
 * Captura de erros client-side que hoje desaparecem em produção.
 * Instala window.onerror + unhandledrejection + visibilitychange fallback;
 * envia para /api/client-log (rate-limited server-side, fila client-side
 * com dedup por assinatura de mensagem).
 *
 * Leve: zero dependências, instala 1x no AppShell.
 */

const REPORT_ENDPOINT = "/api/client-log"
const DEDUP_WINDOW_MS = 60_000
const MAX_FFLUSH_PER_PAGE = 10

let sentSignatures = new Map<string, number>()
let sentCount = 0
let installed = false

function signature(message: string, stack?: string | null): string {
  // primeira linha da stack + mensagem identificam 1 classe de erro
  const stackFirst = (stack || "").split("\n")[1] || ""
  return `${message.slice(0, 120)}|${stackFirst.slice(0, 80)}`
}

function report(level: "error" | "warn", message: string, stack?: string | null, extra?: Record<string, unknown>) {
  if (sentCount >= MAX_FFLUSH_PER_PAGE) return // proteção contra loop de erros
  const sig = signature(message, stack)
  const now = Date.now()
  const last = sentSignatures.get(sig) ?? 0
  if (now - last < DEDUP_WINDOW_MS) return
  sentSignatures.set(sig, now)
  sentCount++

  const payload = {
    level,
    ctx: "client",
    message,
    stack: stack || null,
    url: typeof location !== "undefined" ? location.pathname : null,
    extra: {
      ...extra,
      ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      // marca se a página estava offline (erros de rede emoffline ≠ bugs)
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      ts: Date.now(),
    },
  }

  try {
    void fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      // report de erro não pode: usar beacon via fetch keepalive é suficiente
    }).catch(() => {
      // falha silenciosa — não criar loop de report de erro
    })
  } catch {
    // idem
  }
}

export function useGlobalErrorReporting() {
  useEffect(() => {
    if (installed) return
    installed = true

    window.onerror = (message, _source, _lineno, _colno, error) => {
      const msg = typeof message === "string" ? message : (error?.message || "window.onerror")
      report("error", msg, error?.stack, { kind: "onerror" })
    }

    window.onunhandledrejection = (event) => {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      const stack = reason instanceof Error ? reason.stack : null
      report("error", `unhandledrejection: ${message}`, stack, { kind: "unhandledrejection" })
    }

    return () => {
      // listeners ficam (singleton de app), não remove — installed flag protege
    }
  }, [])
}