import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/realtime", () => ({ useRealtimeTable: vi.fn() }))

import { useHealthLogs, useCreateHealthLog, usePregnancy, useUpsertPregnancy, useAppointments, useCreateAppointment, useDeleteAppointment, useProtocols, useCreateProtocol, useUpdateProtocol, useLogProtocolEntry } from "@/lib/queries/health"
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

const healthLog = {
  id: "log-1", owner_id: "owner-1", kind: "weight",
  value: { kg: 70.5 }, logged_at: "2026-05-03T08:00:00Z",
}

const pregnancy = {
  id: "preg-1", owner_id: "owner-1", due_date: "2026-09-15",
  week: 21, notes: null, created_at: "2026-01-01T00:00:00Z",
}

const appointment = {
  id: "appt-1", owner_id: "owner-1", title: "Pré-natal",
  starts_at: "2026-05-10T14:00:00Z", location: "Clínica X",
  kind: "consulta", created_at: "2026-04-01T00:00:00Z",
}

const protocol = {
  id: "prot-1", owner_id: "owner-1", name: "Vitamina D",
  schedule: null, active: true, created_at: "2026-01-01T00:00:00Z",
}

const entry = {
  id: "entry-1", protocol_id: "prot-1", done_on: "2026-05-03",
  notes: null, created_at: "2026-05-03T08:00:00Z",
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useHealthLogs", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches health logs", async () => {
    MockClient.mockReturnValue({ from: () => chain([healthLog]), auth: authMock() })
    const { result } = renderHook(() => useHealthLogs(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([healthLog])
  })

  it("filters by kind", async () => {
    MockClient.mockReturnValue({ from: () => chain([healthLog]), auth: authMock() })
    const { result } = renderHook(() => useHealthLogs("weight"), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([healthLog])
  })
})

describe("useCreateHealthLog", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates a health log", async () => {
    MockClient.mockReturnValue({ from: () => chain(healthLog), auth: authMock() })
    const { result } = renderHook(() => useCreateHealthLog(), { wrapper: Wrapper })
    result.current.mutate({ kind: "weight", value: { kg: 70.5 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("usePregnancy", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches pregnancy data", async () => {
    MockClient.mockReturnValue({ from: () => chain(pregnancy), auth: authMock() })
    const { result } = renderHook(() => usePregnancy(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.week).toBe(21)
  })

  it("returns null when no data", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => usePregnancy(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe("useUpsertPregnancy", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("upserts pregnancy", async () => {
    MockClient.mockReturnValue({ from: () => chain(pregnancy), auth: authMock() })
    const { result } = renderHook(() => useUpsertPregnancy(), { wrapper: Wrapper })
    result.current.mutate({ due_date: "2026-09-15", week: 21 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useAppointments", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches appointments", async () => {
    MockClient.mockReturnValue({ from: () => chain([appointment]), auth: authMock() })
    const { result } = renderHook(() => useAppointments(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([appointment])
  })
})

describe("useCreateAppointment", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates an appointment", async () => {
    MockClient.mockReturnValue({ from: () => chain(appointment), auth: authMock() })
    const { result } = renderHook(() => useCreateAppointment(), { wrapper: Wrapper })
    result.current.mutate({ title: "Exame", starts_at: "2026-06-01T10:00:00Z" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useDeleteAppointment", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("deletes an appointment", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteAppointment(), { wrapper: Wrapper })
    result.current.mutate("appt-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useProtocols", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches protocols", async () => {
    MockClient.mockReturnValue({ from: () => chain([protocol]), auth: authMock() })
    const { result } = renderHook(() => useProtocols(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([protocol])
  })
})

describe("useCreateProtocol", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates a protocol", async () => {
    MockClient.mockReturnValue({ from: () => chain(protocol), auth: authMock() })
    const { result } = renderHook(() => useCreateProtocol(), { wrapper: Wrapper })
    result.current.mutate({ name: "Vitamina D", active: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useUpdateProtocol", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("updates a protocol", async () => {
    MockClient.mockReturnValue({ from: () => chain({ ...protocol, active: false }), auth: authMock() })
    const { result } = renderHook(() => useUpdateProtocol(), { wrapper: Wrapper })
    result.current.mutate({ id: "prot-1", active: false })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useLogProtocolEntry", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("logs a protocol entry", async () => {
    MockClient.mockReturnValue({ from: () => chain(entry), auth: authMock() })
    const { result } = renderHook(() => useLogProtocolEntry(), { wrapper: Wrapper })
    result.current.mutate({ protocol_id: "prot-1", done_on: "2026-05-03" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
