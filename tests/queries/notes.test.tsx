import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/realtime", () => ({ useRealtimeTable: vi.fn() }))

import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/lib/queries/notes"
import { createClient } from "@/lib/supabase/client"

const MockClient = createClient as unknown as vi.Mock

function chain(value: unknown, error?: string) {
  const result = error ? { data: null, error: { message: error } } : { data: value, error: null }

  function wrap(): Record<string, (...args: unknown[]) => Record<string, unknown>> {
    const proxy: Record<string, unknown> = {}
    return new Proxy(proxy, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            if (error) { return Promise.reject(new Error(error)).catch((err: unknown) => { if (reject) reject(err) }) }
            return Promise.resolve(result).then(resolve)
          }
        }
        return () => wrap()
      },
    })
  }

  return wrap()
}

function authMock() {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "owner-1" } } }, error: null }),
  }
}

const note = {
  id: "note-1", owner_id: "owner-1", title: "Meeting notes",
  content: "Discussed #project-x milestones", tags: ["project-x"],
  pinned: false, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-05-03T09:00:00Z",
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useNotes", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches notes ordered by pinned + updated", async () => {
    MockClient.mockReturnValue({ from: () => chain([note]), auth: authMock() })
    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([note])
  })

  it("handles empty list", async () => {
    MockClient.mockReturnValue({ from: () => chain([]), auth: authMock() })
    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe("useCreateNote", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates a note", async () => {
    MockClient.mockReturnValue({ from: () => chain(note), auth: authMock() })
    const { result } = renderHook(() => useCreateNote(), { wrapper: Wrapper })
    result.current.mutate({ title: "New", content: null, tags: [], pinned: false })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useUpdateNote", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("updates optimistically", async () => {
    MockClient.mockReturnValue({ from: () => chain({ ...note, pinned: true }), auth: authMock() })
    const { result } = renderHook(() => useUpdateNote(), { wrapper: Wrapper })
    result.current.mutate({ id: "note-1", pinned: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useDeleteNote", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("deletes optimistically", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteNote(), { wrapper: Wrapper })
    result.current.mutate("note-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
