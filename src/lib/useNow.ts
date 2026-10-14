"use client"

import { useEffect, useState } from "react"

/** ISO do "agora", atualizado a cada `intervalMs` — evita chamar Date.now() durante o render. */
export function useNow(intervalMs = 60_000): string {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
