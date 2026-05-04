import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))

import { useHabits, useCreateHabit, useUpdateHabit, useDeleteHabit, useHabitEntries, useLogHabitEntry, useDeleteHabitEntry } from "@/lib/queries/habits"
import { createClient } from "@/lib/supabase/client"

const MockClient = createClient as unknown as vi.Mock

function chain(value: unknown, error?: string) {
  const result = error ? { data: null, error: { message: error } } : { data: value, error: null }
  function wrap(): Record<string, (...args: unknown[]) => Record<string, unknown>> {
    const proxy: Record<string, unknown> = {}
    return new Proxy(proxy, {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
        return () => wrap()
      },
    })
  }
  return wrap()
}

function authMock() {
  return { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) }
}

const habit = { id: "h-1", owner_id: "owner-1", name: "Beber água", active: true, created_at: "2026-01-01T00:00:00Z" }
const entry = { id: "e-1", habit_id: "h-1", done_on: "2026-05-03", notes: null, created_at: "2026-05-03T08:00:00Z" }

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useHabits", () => {
  it("fetches habits", async () => {
    MockClient.mockReturnValue({ from: () => chain([habit]), auth: authMock() })
    const { result } = renderHook(() => useHabits(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([habit])
  })
})

describe("useCreateHabit", () => {
  it("creates a habit", async () => {
    MockClient.mockReturnValue({ from: () => chain(habit), auth: authMock() })
    const { result } = renderHook(() => useCreateHabit(), { wrapper: Wrapper })
    result.current.mutate({ name: "Meditar", active: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useUpdateHabit", () => {
  it("updates a habit", async () => {
    MockClient.mockReturnValue({ from: () => chain({ ...habit, active: false }), auth: authMock() })
    const { result } = renderHook(() => useUpdateHabit(), { wrapper: Wrapper })
    result.current.mutate({ id: "h-1", active: false })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useDeleteHabit", () => {
  it("deletes a habit", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteHabit(), { wrapper: Wrapper })
    result.current.mutate("h-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useHabitEntries", () => {
  it("fetches entries for a habit", async () => {
    MockClient.mockReturnValue({ from: () => chain([entry]), auth: authMock() })
    const { result } = renderHook(() => useHabitEntries("h-1"), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([entry])
  })

  it("does not fetch without habitId", async () => {
    MockClient.mockReturnValue({ from: () => chain([]), auth: authMock() })
    const { result } = renderHook(() => useHabitEntries(), { wrapper: Wrapper })
    expect(result.current.isPending).toBe(true)
  })
})

describe("useLogHabitEntry", () => {
  it("logs a habit entry", async () => {
    MockClient.mockReturnValue({ from: () => chain(entry), auth: authMock() })
    const { result } = renderHook(() => useLogHabitEntry(), { wrapper: Wrapper })
    result.current.mutate({ habit_id: "h-1", done_on: "2026-05-03" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useDeleteHabitEntry", () => {
  it("deletes a habit entry", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteHabitEntry(), { wrapper: Wrapper })
    result.current.mutate({ id: "e-1", habit_id: "h-1" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
