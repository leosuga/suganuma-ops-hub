import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/realtime", () => ({ useRealtimeTable: vi.fn() }))

import { useAccounts, useTransactions, useCreateTransaction, useDeleteTransaction } from "@/lib/queries/finance"
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

function chainBatch(values: Record<string, unknown>) {
  function wrap(): Record<string, (...args: unknown[]) => Record<string, unknown>> {
    const proxy: Record<string, unknown> = {}
    return new Proxy(proxy, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            return Promise.resolve(values).then(resolve)
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

const account = {
  id: "acc-1", owner_id: "owner-1", name: "Nubank",
  kind: "checking", currency: "BRL", opening_balance: 1000,
  created_at: "2025-01-01T00:00:00Z",
}

const txn = {
  id: "txn-1", owner_id: "owner-1", account_id: "acc-1",
  kind: "expense" as const, amount: 99.90, currency: "BRL",
  category: "food", description: "Mercado",
  occurred_on: "2026-05-01", created_at: "2026-05-01T12:00:00Z",
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useAccounts", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches accounts", async () => {
    MockClient.mockReturnValue({ from: () => chain([account]), auth: authMock() })
    const { result } = renderHook(() => useAccounts(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([account])
  })
})

describe("useTransactions", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches all transactions", async () => {
    MockClient.mockReturnValue({ from: () => chain([txn]), auth: authMock() })
    const { result } = renderHook(() => useTransactions(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([txn])
  })

  it("filters by month", async () => {
    MockClient.mockReturnValue({ from: () => chain([txn]), auth: authMock() })
    const { result } = renderHook(() => useTransactions({ month: "2026-05" }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([txn])
  })

  it("filters by kind", async () => {
    MockClient.mockReturnValue({ from: () => chain([txn]), auth: authMock() })
    const { result } = renderHook(() => useTransactions({ kind: "expense" }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([txn])
  })
})

describe("useCreateTransaction", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates a transaction", async () => {
    MockClient.mockReturnValue({ from: () => chain(txn), auth: authMock() })
    const { result } = renderHook(() => useCreateTransaction(), { wrapper: Wrapper })
    result.current.mutate({
      kind: "expense", amount: 50, currency: "BRL",
      occurred_on: "2026-05-01", category: null, description: null,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useDeleteTransaction", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("deletes optimistically", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: Wrapper })
    result.current.mutate("txn-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
