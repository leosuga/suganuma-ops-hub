"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { semanticSearchNotes } from "@/lib/actions/semantic-search"
import type { NoteRow } from "@/lib/types"

export function useSemanticSearch() {
  const [query, setQuery] = useState("")

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["semantic-search", query],
    queryFn: async (): Promise<Array<NoteRow & { score: number }>> => {
      if (!query.trim()) return []
      const res = await semanticSearchNotes(query.trim(), 10)
      if (!res.ok) throw new Error(res.error || "Search failed")
      return res.results as Array<NoteRow & { score: number }>
    },
    enabled: false, // só executa quando refetch() é chamado manualmente
    staleTime: 0,
    gcTime: 5 * 60_000,
  })

  return {
    query,
    setQuery,
    results: data ?? [],
    isLoading: isLoading || isFetching,
    search: refetch,
  }
}
