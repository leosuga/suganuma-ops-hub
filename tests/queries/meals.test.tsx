import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))

import { useMeals, useCreateMeal, useDeleteMeal, useMealPlans, useSetMealPlan } from "@/lib/queries/meals"
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

const meal = {
  id: "meal-1", owner_id: "owner-1", name: "Frango grelhado",
  kind: "recipe", tags: ["proteína"], ingredients: ["frango", "azeite"],
  prep_time: 30, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
}

const mealPlan = {
  id: "plan-1", owner_id: "owner-1", meal_id: "meal-1",
  date: "2026-05-05", meal_type: "lunch", notes: null, created_at: "2026-05-05T00:00:00Z",
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useMeals", () => {
  it("fetches meals", async () => {
    MockClient.mockReturnValue({ from: () => chain([meal]), auth: authMock() })
    const { result } = renderHook(() => useMeals(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([meal])
  })
})

describe("useCreateMeal", () => {
  it("creates a meal", async () => {
    MockClient.mockReturnValue({ from: () => chain(meal), auth: authMock() })
    const { result } = renderHook(() => useCreateMeal(), { wrapper: Wrapper })
    result.current.mutate({ name: "Nova", kind: "recipe", tags: [], ingredients: [], prep_time: null, notes: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useDeleteMeal", () => {
  it("deletes a meal", async () => {
    MockClient.mockReturnValue({ from: () => chain(null), auth: authMock() })
    const { result } = renderHook(() => useDeleteMeal(), { wrapper: Wrapper })
    result.current.mutate("meal-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe("useMealPlans", () => {
  it("fetches meal plans for a week", async () => {
    MockClient.mockReturnValue({ from: () => chain([mealPlan]), auth: authMock() })
    const { result } = renderHook(() => useMealPlans("2026-05-04"), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([mealPlan])
  })
})

describe("useSetMealPlan", () => {
  it("sets a meal plan", async () => {
    MockClient.mockReturnValue({ from: () => chain(mealPlan), auth: authMock() })
    const { result } = renderHook(() => useSetMealPlan(), { wrapper: Wrapper })
    result.current.mutate({ date: "2026-05-05", meal_type: "lunch", meal_id: "meal-1", notes: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
