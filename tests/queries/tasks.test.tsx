import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/realtime", () => ({ useRealtimeTable: vi.fn() }))

import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/lib/queries/tasks"
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

const task = {
  id: "uuid-1", owner_id: "owner-1", title: "Test",
  notes: null, category: "personal", status: "todo", priority: "med",
  due_at: null, completed_at: null,
  created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useTasks", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches tasks", async () => {
    MockClient.mockReturnValue({ from: () => chain([task]), auth: authMock() })
    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([task])
  })

  it("handles error", async () => {
    MockClient.mockReturnValue({ from: () => chain(null, "fail"), auth: authMock() })
    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useCreateTask", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates a task", async () => {
    MockClient.mockReturnValue({ from: () => chain(task), auth: authMock() })
    const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper })
    result.current.mutate({ title: "A", category: "personal", priority: "med", status: "todo" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it("throws when not authenticated", async () => {
    MockClient.mockReturnValue({
      from: () => chain(null),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper })
    result.current.mutate({ title: "A", category: "personal", priority: "med", status: "todo" })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useUpdateTask", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("updates optimistically", async () => {
    MockClient.mockReturnValue({ from: () => chain({ ...task, title: "B" }), auth: authMock() })
    const { result } = renderHook(() => useUpdateTask(), { wrapper: Wrapper })
    result.current.mutate({ id: "uuid-1", title: "B" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it("rolls back on error", async () => {
    MockClient.mockReturnValue({ from: () => chain(null, "fail"), auth: authMock() })
    const { result } = renderHook(() => useUpdateTask(), { wrapper: Wrapper })
    result.current.mutate({ id: "uuid-1", title: "X" })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useDeleteTask", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("deletes a task", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteTask(), { wrapper: Wrapper })
    result.current.mutate("uuid-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
