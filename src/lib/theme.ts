"use client"

import { useCallback, useEffect } from "react"

export type Accent = "teal" | "blue" | "green" | "purple" | "orange"

const ACCENTS: Record<Accent, { main: string; hi: string }> = {
  teal: { main: "#55D7ED", hi: "#9EEFFF" },
  blue: { main: "#60A5FA", hi: "#93C5FD" },
  green: { main: "#4ADE80", hi: "#86EFAC" },
  purple: { main: "#C084FC", hi: "#D8B4FE" },
  orange: { main: "#FB923C", hi: "#FDBA74" },
}

const KEY = "ops_hub_accent"

export function getAccent(): Accent {
  if (typeof window === "undefined") return "teal"
  return (localStorage.getItem(KEY) as Accent) ?? "teal"
}

export function setAccent(accent: Accent) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, accent)
  const colors = ACCENTS[accent]
  // `--brand` (e não `--color-accent`): o @theme inline faz as utilities
  // lerem `var(--brand)` diretamente, então escrever `--color-accent` não
  // mudava nada. Ver globals.css § tokens de marca.
  document.documentElement.style.setProperty("--brand", colors.main)
  document.documentElement.style.setProperty("--brand-hi", colors.hi)
}

export function useInitAccent() {
  useEffect(() => {
    setAccent(getAccent())
  }, [])
}
