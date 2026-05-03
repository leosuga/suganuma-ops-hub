"use client"

import { useCallback, useEffect } from "react"

type Accent = "teal" | "blue" | "green" | "purple" | "orange"

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
  document.documentElement.style.setProperty("--color-accent", colors.main)
  document.documentElement.style.setProperty("--color-accent-hi", colors.hi)
}

export function useInitAccent() {
  useEffect(() => {
    setAccent(getAccent())
  }, [])
}

export function useAccent() {
  useInitAccent()
  return { getAccent, setAccent, accents: ACCENTS }
}
