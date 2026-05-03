import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/realtime", () => ({
  useRealtimeTable: vi.fn(),
}))

export { vi }
