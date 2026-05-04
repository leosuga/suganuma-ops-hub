"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

const NOTIFIED_KEY = "ops_hub_notified_ts"
const CHECK_INTERVAL = 5 * 60 * 1000

async function checkAndNotify() {
  if (typeof window === "undefined") return
  if (Notification.permission !== "granted") return

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const now = new Date()
  const lastCheck = localStorage.getItem(NOTIFIED_KEY)
  const lastTs = lastCheck ? new Date(lastCheck).getTime() : 0

  if (now.getTime() - lastTs < 10_000) return

  const [overdueRes, upcomingRes] = await Promise.all([
    supabase
      .from("task")
      .select("id, title, due_at")
      .eq("owner_id", user.id)
      .in("status", ["todo", "doing"])
      .lt("due_at", now.toISOString())
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("appointment")
      .select("id, title, starts_at")
      .eq("owner_id", user.id)
      .gte("starts_at", now.toISOString())
      .lt("starts_at", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(3),
  ])

  const overdue = overdueRes.data
  const upcoming = upcomingRes.data

  let notified = false

  if (overdue && overdue.length > 0) {
    const first = overdue[0]
    const msg = overdue.length === 1
      ? `"${first.title.slice(0, 80)}"`
      : `"${first.title.slice(0, 50)}" e +${overdue.length - 1} task(s)`
    try {
      new Notification("Task atrasada", {
        body: msg,
        icon: "/icon-192.png",
        tag: "overdue-tasks",
        requireInteraction: true,
      })
      notified = true
    } catch { /* browser blocks */ }
  }

  if (upcoming && upcoming.length > 0) {
    const names = upcoming.map((a) => {
      const t = new Date(a.starts_at)
      return `${t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ${a.title}`
    }).join(", ")
    try {
      new Notification("Consulta hoje ou amanhã", {
        body: names,
        icon: "/icon-192.png",
        tag: "upcoming-appts",
        requireInteraction: true,
      })
      notified = true
    } catch { /* browser blocks */ }
  }

  if (!notified) {
    localStorage.setItem(NOTIFIED_KEY, now.toISOString())
    return
  }

  localStorage.setItem(NOTIFIED_KEY, now.toISOString())
}

export function useTaskNotifications() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    checkAndNotify()

    intervalRef.current = setInterval(checkAndNotify, CHECK_INTERVAL)

    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return

      channel = supabase
        .channel("rt:task-notifs")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "task", filter: `owner_id=eq.${session.user.id}` },
          () => {
            checkAndNotify()
          }
        )
        .subscribe()
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])
}
