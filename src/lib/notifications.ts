"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { today, dateStr } from "@/lib/date"
import { fmtShortTime } from "@/lib/format"

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

  const [overdueRes, upcomingRes, annualRes] = await Promise.all([
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
      supabase
        .from("annual_event")
        .select("id, title, start_date")
        .eq("owner_id", user.id)
        .gte("start_date", today())
        .lte("start_date", dateStr(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)))
        .order("start_date", { ascending: true })
        .limit(5),
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
      return `${fmtShortTime(t)} ${a.title}`
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

  const annual = annualRes.data
  if (annual && annual.length > 0) {
    const names = annual.map((e) => {
      const t = new Date(e.start_date)
      return `${t.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${e.title}`
    }).join(", ")
    try {
      new Notification("Evento do calendário próximo", {
        body: names,
        icon: "/icon-192.png",
        tag: "upcoming-annual",
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
  const channelsRef = useRef<RealtimeChannel[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    checkAndNotify()

    intervalRef.current = setInterval(checkAndNotify, CHECK_INTERVAL)

    const supabase = createClient()
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session) return

      const userId = session.user.id
      const channels: RealtimeChannel[] = []

      channels.push(
        supabase
          .channel("rt:task-notifs")
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "task", filter: `owner_id=eq.${userId}` },
            () => checkAndNotify()
          )
          .subscribe()
      )

      channels.push(
        supabase
          .channel("rt:annual-notifs")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "annual_event", filter: `owner_id=eq.${userId}` },
            () => checkAndNotify()
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "annual_event", filter: `owner_id=eq.${userId}` },
            () => checkAndNotify()
          )
          .subscribe()
      )

      channels.push(
        supabase
          .channel("rt:appt-notifs")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "appointment", filter: `owner_id=eq.${userId}` },
            () => checkAndNotify()
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "appointment", filter: `owner_id=eq.${userId}` },
            () => checkAndNotify()
          )
          .subscribe()
      )

      channelsRef.current = channels
    })

    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      for (const ch of channelsRef.current) {
        supabase.removeChannel(ch)
      }
      channelsRef.current = []
    }
  }, [])
}

export function useNotifications() {
  return useTaskNotifications()
}
