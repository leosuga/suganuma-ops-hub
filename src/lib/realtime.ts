"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/realtime-js"

type ChannelStatus = REALTIME_SUBSCRIBE_STATES

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

const activeChannels = new Map<string, { channel: RealtimeChannel; refCount: number }>()

const TABLE_QUERY_PREFIX: Record<string, string[]> = {
  task: ["tasks", "calendar", "reports"],
  note: ["notes"],
  transaction: ["finance", "reports"],
  account: ["finance"],
  health_log: ["health"],
  appointment: ["health", "calendar"],
  pregnancy: ["health"],
  protocol: ["health"],
  protocol_entry: ["health"],
  project: ["projects"],
  meal: ["meals"],
  meal_plan: ["meals", "calendar"],
  habit_track: ["habits", "reports"],
  habit_entry: ["habits", "reports"],
  budget: ["budget"],
  annual_event: ["annual-event"],
  inbox_item: ["inbox"],
  person: ["people"],
  person_relation: ["people"],
  person_conflict: ["people"],
  guest_event: ["people"],
  guest_invite: ["people"],
}

// Tabelas sem coluna owner_id — o filtro `owner_id=eq.<uid>` do Realtime falha
// silenciosamente nelas (nenhum evento chega, sem erro visível). A invalidação
// batida por essas tabelas ainda é segura: os dados em si continuam vindo de
// queries com .eq("owner_id", ...); o único efeito de não filtrar aqui é
// refetch extra quando outro owner muda uma entry.
const NO_OWNER_FILTER_TABLES = new Set(["habit_entry", "protocol_entry"])

// Debounce realtime invalidations: when multiple changes arrive in quick succession
// (e.g. bulk insert, or 3 tables invalidating "calendar" simultaneously),
// batch them into a single refetch after 300ms.
const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>()
const INVALIDATION_DEBOUNCE_MS = 300

function invalidatePrefixes(queryClient: ReturnType<typeof useQueryClient>, prefixes: string[]) {
  for (const prefix of prefixes) {
    // Clear any pending invalidation for this prefix and set a new one
    const existing = pendingInvalidations.get(prefix)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: [prefix], exact: false })
      pendingInvalidations.delete(prefix)
    }, INVALIDATION_DEBOUNCE_MS)
    pendingInvalidations.set(prefix, timer)
  }
}

function invalidateTable(queryClient: ReturnType<typeof useQueryClient>, table: string) {
  const prefixes = TABLE_QUERY_PREFIX[table]
  if (prefixes) {
    invalidatePrefixes(queryClient, prefixes)
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
              ...(NO_OWNER_FILTER_TABLES.has(table) ? {} : { filter: `owner_id=eq.${session.user.id}` }),
            },
            () => {
              invalidateTable(queryClient, table)
            }
          )
          .subscribe((status: ChannelStatus) => {
            // Canal morto = UI stale silenciosa. Logar dá diagnóstico onde
            // antes não havia nada; o supabase-js reestabelece o socket, e o
            // status CHANNEL_ERROR sinaliza para futura lógica de resubscribe.
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              logger.warn("realtime", `channel ${channelKey} status: ${status}`, { table })
            }
          })

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