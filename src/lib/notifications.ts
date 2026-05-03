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

  const { data: overdue } = await supabase
    .from("task")
    .select("id, title, due_at")
    .eq("owner_id", user.id)
    .in("status", ["todo", "doing"])
    .lt("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(5)

  if (!overdue || overdue.length === 0) {
    localStorage.setItem(NOTIFIED_KEY, now.toISOString())
    return
  }

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
  } catch {
    // browser blocks notification
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
