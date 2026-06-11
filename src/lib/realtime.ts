"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

const activeChannels = new Map<string, { channel: RealtimeChannel; refCount: number }>()

const TABLE_QUERY_PREFIX: Record<string, string[]> = {
  task: ["tasks"],
  note: ["notes"],
  transaction: ["finance"],
  account: ["finance"],
  health_log: ["health"],
  appointment: ["health"],
  pregnancy: ["health"],
  protocol: ["health"],
  protocol_entry: ["health"],
  project: ["projects"],
  meal: ["meals"],
  meal_plan: ["meals"],
  habit_track: ["habits"],
  habit_entry: ["habits"],
  budget: ["budget"],
  annual_event: ["annual-event"],
}

function invalidateTable(queryClient: ReturnType<typeof useQueryClient>, table: string) {
  const prefix = TABLE_QUERY_PREFIX[table]
  if (prefix) {
    queryClient.invalidateQueries({ queryKey: prefix, exact: false })
  } else {
    queryClient.invalidateQueries()
  }
}

export function useRealtimeTable(table: string, _queryKey?: readonly unknown[]) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let channelKey: string | null = null

    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) return

        channelKey = `rt:${table}:${session.user.id}`
        const existing = activeChannels.get(channelKey)
        if (existing) {
          existing.refCount++
          return
        }

        const supabase = createClient()
        const channel = supabase
          .channel(channelKey)
          .on<ChangePayload>(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              filter: `owner_id=eq.${session.user.id}`,
            },
            () => {
              invalidateTable(queryClient, table)
            }
          )
          .subscribe()

        activeChannels.set(channelKey, { channel, refCount: 1 })
      })

    return () => {
      if (!channelKey) return
      const entry = activeChannels.get(channelKey)
      if (!entry) return

      entry.refCount--
      if (entry.refCount <= 0) {
        const supabase = createClient()
        supabase.removeChannel(entry.channel)
        activeChannels.delete(channelKey)
      }
    }
  }, [table, queryClient])
}