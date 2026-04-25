"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

// Registra um canal Postgres Changes para a tabela informada,
// filtrando por owner_id do usuário autenticado.
// Em qualquer evento (insert/update/delete), invalida queryKey.
export function useRealtimeTable(table: string, queryKey: readonly unknown[]) {
  const queryClient = useQueryClient()
  const queryKeyRef = useRef(queryKey)
  queryKeyRef.current = queryKey

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return

      channel = supabase
        .channel(`rt:${table}:${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `owner_id=eq.${session.user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
          }
        )
        .subscribe()
    })

    return () => {
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
    }
  }, [table, queryClient])
}
